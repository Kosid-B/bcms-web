-- ============================================================
-- Audit Log + Soft-Delete Pattern
-- ISO 22301 Clause 9.1 — Objective Evidence / Audit Trail
-- ============================================================

-- Drop previous partial attempt if exists
drop table if exists public.audit_log cascade;

-- ── 1. audit_log table ──────────────────────────────────────
create table public.audit_log (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete set null,
  action        text        not null,  -- INSERT | UPDATE | DELETE
  tbl           text        not null,
  record_id     uuid        not null,
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Org members can read their own audit trail
create policy "audit_log_select_org" on public.audit_log
  for select using (org_id = public.current_org_id());

-- Insert only via trigger (service role bypasses RLS)
create policy "audit_log_insert_trigger" on public.audit_log
  for insert with check (true);

-- Fast lookups by org + table + record
create index audit_log_org_tbl_record
  on public.audit_log (org_id, tbl, record_id, created_at desc);

-- ── 2. Generic audit trigger function ───────────────────────
-- Uses to_jsonb() instead of OLD.column — avoids compile-time
-- column validation so one function works across all tables.
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row      jsonb;
  v_old      jsonb;
  v_new      jsonb;
  v_org_id   uuid;
  v_user_id  uuid;
  v_record   uuid;
begin
  if TG_OP = 'DELETE' then
    v_row  := to_jsonb(OLD);
    v_old  := v_row;
    v_new  := null;
  elsif TG_OP = 'UPDATE' then
    v_row  := to_jsonb(NEW);
    v_old  := to_jsonb(OLD);
    v_new  := v_row;
  else
    v_row  := to_jsonb(NEW);
    v_old  := null;
    v_new  := v_row;
  end if;

  v_org_id  := (v_row->>'org_id')::uuid;
  v_record  := (v_row->>'id')::uuid;

  begin
    v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  exception when others then
    v_user_id := null;
  end;

  insert into public.audit_log (org_id, user_id, action, tbl, record_id, old_data, new_data)
  values (v_org_id, v_user_id, TG_OP, TG_TABLE_NAME, v_record, v_old, v_new);

  return null;
end;
$$;

-- ── 3. Attach trigger to core BCMS tables ───────────────────
drop trigger if exists trg_audit_bia_processes on public.bia_processes;
create trigger trg_audit_bia_processes
  after insert or update or delete on public.bia_processes
  for each row execute function public.fn_audit_log();

drop trigger if exists trg_audit_bc_plans on public.bc_plans;
create trigger trg_audit_bc_plans
  after insert or update or delete on public.bc_plans
  for each row execute function public.fn_audit_log();

drop trigger if exists trg_audit_exercises on public.exercises;
create trigger trg_audit_exercises
  after insert or update or delete on public.exercises
  for each row execute function public.fn_audit_log();

drop trigger if exists trg_audit_capa_items on public.capa_items;
create trigger trg_audit_capa_items
  after insert or update or delete on public.capa_items
  for each row execute function public.fn_audit_log();

-- ── 4. Soft-delete: add deleted_at to core tables ───────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bia_processes' and column_name = 'deleted_at'
  ) then
    alter table public.bia_processes add column deleted_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bc_plans' and column_name = 'deleted_at'
  ) then
    alter table public.bc_plans add column deleted_at timestamptz;
  end if;
end;
$$;

-- Partial index: soft-deleted rows invisible in normal queries
create index if not exists idx_bia_processes_active
  on public.bia_processes (org_id, created_at desc) where deleted_at is null;

create index if not exists idx_bc_plans_active
  on public.bc_plans (org_id, created_at desc) where deleted_at is null;
