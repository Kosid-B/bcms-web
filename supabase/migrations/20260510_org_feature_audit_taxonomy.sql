create table if not exists public.org_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  dept_code text not null,
  dept_name text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, dept_code),
  unique (org_id, dept_name)
);

create table if not exists public.org_audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists org_departments_org_idx on public.org_departments(org_id);
create index if not exists org_departments_active_idx on public.org_departments(org_id, is_active);
create index if not exists org_audit_logs_org_idx on public.org_audit_logs(org_id, created_at desc);
create index if not exists org_audit_logs_action_idx on public.org_audit_logs(org_id, action);

drop trigger if exists trg_org_departments_updated_at on public.org_departments;
create trigger trg_org_departments_updated_at
before update on public.org_departments
for each row execute function public.touch_updated_at();

alter table public.org_departments enable row level security;
alter table public.org_audit_logs enable row level security;

drop policy if exists "org_departments_org_members_select" on public.org_departments;
create policy "org_departments_org_members_select" on public.org_departments
for select to authenticated
using (org_id = public.current_org_id());

drop policy if exists "org_departments_org_admin_manage" on public.org_departments;
create policy "org_departments_org_admin_manage" on public.org_departments
for all to authenticated
using (org_id = public.current_org_id() and public.is_org_admin())
with check (org_id = public.current_org_id() and public.is_org_admin());

drop policy if exists "org_audit_logs_org_members_select" on public.org_audit_logs;
create policy "org_audit_logs_org_members_select" on public.org_audit_logs
for select to authenticated
using (org_id = public.current_org_id());

drop policy if exists "org_audit_logs_org_admin_insert" on public.org_audit_logs;
create policy "org_audit_logs_org_admin_insert" on public.org_audit_logs
for insert to authenticated
with check (org_id = public.current_org_id() and public.is_org_admin());

