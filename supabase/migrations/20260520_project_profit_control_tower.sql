-- Project Profit Control Tower schema
-- Acceptance targets for manual verification after push:
-- 1. org members can select only rows belonging to their org
-- 2. a project template can be instantiated into a project
-- 3. billing documents can be marked complete / incomplete per cycle
-- 4. alerts can be filtered by severity and status
-- 5. cash entries roll up by project_id without cross-org leakage

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  project_type text not null default 'pole-installation',
  unit_label text not null default 'ต้น',
  target_units integer not null default 0 check (target_units >= 0),
  target_profit_thb numeric(14,2) not null default 0,
  target_margin_pct numeric(8,2) not null default 0,
  target_npv_thb numeric(14,2) not null default 0,
  target_irr_pct numeric(8,2) not null default 0,
  target_mirr_pct numeric(8,2) not null default 0,
  hurdle_rate_pct numeric(8,2) not null default 0,
  discount_rate_pct numeric(8,2) not null default 0,
  reinvestment_rate_pct numeric(8,2) not null default 0,
  target_payback_days integer not null default 14 check (target_payback_days >= 0),
  machinery_budget_thb numeric(14,2) not null default 0,
  billing_window_days text[] not null default array['monday', 'tuesday'],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, name)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.project_templates(id) on delete set null,
  name text not null,
  code text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date date,
  end_date date,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  current_cash_balance_thb numeric(14,2) not null default 0,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, code)
);

create table if not exists public.project_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  province text not null,
  cluster_name text not null,
  target_units integer not null default 0 check (target_units >= 0),
  actual_units integer not null default 0 check (actual_units >= 0),
  baseline_cost_thb numeric(14,2) not null default 0,
  actual_cost_thb numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, cluster_name)
);

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  entry_date date not null,
  entry_type text not null,
  direction text not null check (direction in ('in', 'out')),
  amount_thb numeric(14,2) not null constraint cash_entries_amount_thb_positive check (amount_thb > 0),
  note text,
  source_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cycle_name text not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  expected_collection_date date,
  actual_collection_date date,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'collected')),
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, cycle_name)
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  billing_cycle_id uuid not null references public.billing_cycles(id) on delete cascade,
  document_type text not null,
  is_complete boolean not null default false,
  file_url text,
  note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (billing_cycle_id, document_type)
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  asset_code text not null,
  name text not null,
  investment_phase text not null default 'phase_1',
  purchase_cost_thb numeric(14,2) not null default 0,
  utilization_pct numeric(8,2) not null default 0 check (utilization_pct between 0 and 100),
  status text not null default 'idle' check (status in ('idle', 'assigned', 'operating', 'maintenance', 'retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, asset_code)
);

create table if not exists public.machine_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  usage_date date not null,
  operating_hours numeric(8,2) not null default 0 check (operating_hours >= 0),
  downtime_hours numeric(8,2) not null default 0 check (downtime_hours >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  progress_date date not null,
  completed_units integer not null default 0 check (completed_units >= 0),
  rework_units integer not null default 0 check (rework_units >= 0),
  defect_count integer not null default 0 check (defect_count >= 0),
  waiting_minutes integer not null default 0 check (waiting_minutes >= 0),
  crew_size integer not null default 0 check (crew_size >= 0),
  photo_report_url text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  alert_type text not null,
  title text not null,
  impact_summary text not null,
  recommended_action text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_templates_org_id_idx on public.project_templates(org_id);
create index if not exists project_templates_type_idx on public.project_templates(org_id, project_type);
create index if not exists projects_org_id_idx on public.projects(org_id);
create index if not exists projects_template_idx on public.projects(template_id);
create index if not exists projects_status_idx on public.projects(org_id, status);
create index if not exists projects_owner_idx on public.projects(owner_profile_id);
create index if not exists project_clusters_project_idx on public.project_clusters(project_id);
create index if not exists project_clusters_org_province_idx on public.project_clusters(org_id, province);
create index if not exists cash_entries_project_date_idx on public.cash_entries(org_id, project_id, entry_date desc);
create index if not exists cash_entries_cluster_idx on public.cash_entries(cluster_id);
create index if not exists billing_cycles_project_status_idx on public.billing_cycles(org_id, project_id, status);
create index if not exists billing_cycles_collection_idx on public.billing_cycles(org_id, expected_collection_date);
create index if not exists billing_documents_cycle_idx on public.billing_documents(billing_cycle_id);
create index if not exists billing_documents_status_idx on public.billing_documents(org_id, is_complete);
create index if not exists machines_org_status_idx on public.machines(org_id, status);
create index if not exists machines_project_idx on public.machines(project_id);
create index if not exists machine_usage_project_date_idx on public.machine_usage(org_id, project_id, usage_date desc);
create index if not exists machine_usage_machine_date_idx on public.machine_usage(machine_id, usage_date desc);
create index if not exists daily_progress_project_date_idx on public.daily_progress(org_id, project_id, progress_date desc);
create index if not exists daily_progress_cluster_date_idx on public.daily_progress(cluster_id, progress_date desc);
create index if not exists project_alerts_status_idx on public.project_alerts(org_id, status, severity);
create index if not exists project_alerts_project_due_idx on public.project_alerts(project_id, due_date);
create unique index if not exists project_templates_org_id_id_idx on public.project_templates(org_id, id);
create unique index if not exists projects_org_id_id_idx on public.projects(org_id, id);
create unique index if not exists billing_cycles_org_id_id_idx on public.billing_cycles(org_id, id);
create unique index if not exists machines_org_id_id_idx on public.machines(org_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_clusters_org_project_fk'
      and conrelid = 'public.project_clusters'::regclass
  ) then
    alter table public.project_clusters
      add constraint project_clusters_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_entries_org_project_fk'
      and conrelid = 'public.cash_entries'::regclass
  ) then
    alter table public.cash_entries
      add constraint cash_entries_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_cycles_org_project_fk'
      and conrelid = 'public.billing_cycles'::regclass
  ) then
    alter table public.billing_cycles
      add constraint billing_cycles_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_documents_org_billing_cycle_fk'
      and conrelid = 'public.billing_documents'::regclass
  ) then
    alter table public.billing_documents
      add constraint billing_documents_org_billing_cycle_fk
      foreign key (org_id, billing_cycle_id)
      references public.billing_cycles(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'machine_usage_org_machine_fk'
      and conrelid = 'public.machine_usage'::regclass
  ) then
    alter table public.machine_usage
      add constraint machine_usage_org_machine_fk
      foreign key (org_id, machine_id)
      references public.machines(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'machine_usage_org_project_fk'
      and conrelid = 'public.machine_usage'::regclass
  ) then
    alter table public.machine_usage
      add constraint machine_usage_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_progress_org_project_fk'
      and conrelid = 'public.daily_progress'::regclass
  ) then
    alter table public.daily_progress
      add constraint daily_progress_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_alerts_org_project_fk'
      and conrelid = 'public.project_alerts'::regclass
  ) then
    alter table public.project_alerts
      add constraint project_alerts_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_entries_amount_thb_positive'
      and conrelid = 'public.cash_entries'::regclass
  ) then
    alter table public.cash_entries
      add constraint cash_entries_amount_thb_positive
      check (amount_thb > 0);
  end if;
end;
$$;

create or replace function public.validate_project_profit_linkage()
returns trigger
language plpgsql
as $$
declare
  linked_org_id uuid;
  linked_project_id uuid;
begin
  if tg_table_name = 'projects' then
    if new.template_id is null then
      return new;
    end if;

    select org_id
    into linked_org_id
    from public.project_templates
    where id = new.template_id;

    if linked_org_id is null then
      raise exception 'project template % does not exist', new.template_id
        using errcode = '23503';
    end if;

    if linked_org_id <> new.org_id then
      raise exception 'project template % must belong to org %', new.template_id, new.org_id
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'machines' then
    if new.project_id is null then
      return new;
    end if;

    select org_id
    into linked_org_id
    from public.projects
    where id = new.project_id;

    if linked_org_id is null then
      raise exception 'project % does not exist', new.project_id
        using errcode = '23503';
    end if;

    if linked_org_id <> new.org_id then
      raise exception 'project % must belong to org %', new.project_id, new.org_id
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.cluster_id is null then
    return new;
  end if;

  select org_id, project_id
  into linked_org_id, linked_project_id
  from public.project_clusters
  where id = new.cluster_id;

  if linked_org_id is null then
    raise exception 'cluster % does not exist', new.cluster_id
      using errcode = '23503';
  end if;

  if linked_org_id <> new.org_id or linked_project_id <> new.project_id then
    raise exception 'cluster % must belong to org % and project %', new.cluster_id, new.org_id, new.project_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_project_profit_parent_updates()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'project_templates' then
    if new.org_id is not distinct from old.org_id then
      return new;
    end if;

    perform 1
    from public.projects
    where template_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move project template % to org % while projects still reference it', old.id, new.org_id
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'projects' then
    if new.org_id is not distinct from old.org_id then
      return new;
    end if;

    perform 1
    from public.machines
    where project_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move project % to org % while machines still reference it', old.id, new.org_id
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'project_clusters' then
    if new.org_id is not distinct from old.org_id
       and new.project_id is not distinct from old.project_id then
      return new;
    end if;

    perform 1
    from public.cash_entries
    where cluster_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move cluster % while cash entries still reference it', old.id
        using errcode = '23514';
    end if;

    perform 1
    from public.machine_usage
    where cluster_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move cluster % while machine usage rows still reference it', old.id
        using errcode = '23514';
    end if;

    perform 1
    from public.daily_progress
    where cluster_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move cluster % while daily progress rows still reference it', old.id
        using errcode = '23514';
    end if;

    perform 1
    from public.project_alerts
    where cluster_id = old.id
    limit 1;

    if found then
      raise exception 'cannot move cluster % while project alerts still reference it', old.id
        using errcode = '23514';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_templates_guard_parent_updates on public.project_templates;
create trigger trg_project_templates_guard_parent_updates
before update of org_id on public.project_templates
for each row execute function public.guard_project_profit_parent_updates();

drop trigger if exists trg_project_templates_updated_at on public.project_templates;
create trigger trg_project_templates_updated_at
before update on public.project_templates
for each row execute function public.touch_updated_at();

drop trigger if exists trg_projects_guard_parent_updates on public.projects;
create trigger trg_projects_guard_parent_updates
before update of org_id on public.projects
for each row execute function public.guard_project_profit_parent_updates();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_clusters_guard_parent_updates on public.project_clusters;
create trigger trg_project_clusters_guard_parent_updates
before update of org_id, project_id on public.project_clusters
for each row execute function public.guard_project_profit_parent_updates();

drop trigger if exists trg_project_clusters_updated_at on public.project_clusters;
create trigger trg_project_clusters_updated_at
before update on public.project_clusters
for each row execute function public.touch_updated_at();

drop trigger if exists trg_billing_cycles_updated_at on public.billing_cycles;
create trigger trg_billing_cycles_updated_at
before update on public.billing_cycles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_billing_documents_updated_at on public.billing_documents;
create trigger trg_billing_documents_updated_at
before update on public.billing_documents
for each row execute function public.touch_updated_at();

drop trigger if exists trg_machines_updated_at on public.machines;
create trigger trg_machines_updated_at
before update on public.machines
for each row execute function public.touch_updated_at();

drop trigger if exists trg_machine_usage_updated_at on public.machine_usage;
create trigger trg_machine_usage_updated_at
before update on public.machine_usage
for each row execute function public.touch_updated_at();

drop trigger if exists trg_daily_progress_updated_at on public.daily_progress;
create trigger trg_daily_progress_updated_at
before update on public.daily_progress
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_alerts_updated_at on public.project_alerts;
create trigger trg_project_alerts_updated_at
before update on public.project_alerts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_projects_validate_linkage on public.projects;
create trigger trg_projects_validate_linkage
before insert or update on public.projects
for each row execute function public.validate_project_profit_linkage();

drop trigger if exists trg_machines_validate_linkage on public.machines;
create trigger trg_machines_validate_linkage
before insert or update on public.machines
for each row execute function public.validate_project_profit_linkage();

drop trigger if exists trg_cash_entries_validate_linkage on public.cash_entries;
create trigger trg_cash_entries_validate_linkage
before insert or update on public.cash_entries
for each row execute function public.validate_project_profit_linkage();

drop trigger if exists trg_machine_usage_validate_linkage on public.machine_usage;
create trigger trg_machine_usage_validate_linkage
before insert or update on public.machine_usage
for each row execute function public.validate_project_profit_linkage();

drop trigger if exists trg_daily_progress_validate_linkage on public.daily_progress;
create trigger trg_daily_progress_validate_linkage
before insert or update on public.daily_progress
for each row execute function public.validate_project_profit_linkage();

drop trigger if exists trg_project_alerts_validate_linkage on public.project_alerts;
create trigger trg_project_alerts_validate_linkage
before insert or update on public.project_alerts
for each row execute function public.validate_project_profit_linkage();

alter table public.project_templates enable row level security;
alter table public.projects enable row level security;
alter table public.project_clusters enable row level security;
alter table public.cash_entries enable row level security;
alter table public.billing_cycles enable row level security;
alter table public.billing_documents enable row level security;
alter table public.machines enable row level security;
alter table public.machine_usage enable row level security;
alter table public.daily_progress enable row level security;
alter table public.project_alerts enable row level security;

drop policy if exists "project_templates_org_members_all" on public.project_templates;
create policy "project_templates_org_members_all" on public.project_templates
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "projects_org_members_all" on public.projects;
create policy "projects_org_members_all" on public.projects
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "project_clusters_org_members_all" on public.project_clusters;
create policy "project_clusters_org_members_all" on public.project_clusters
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "cash_entries_org_members_all" on public.cash_entries;
create policy "cash_entries_org_members_all" on public.cash_entries
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "billing_cycles_org_members_all" on public.billing_cycles;
create policy "billing_cycles_org_members_all" on public.billing_cycles
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "billing_documents_org_members_all" on public.billing_documents;
create policy "billing_documents_org_members_all" on public.billing_documents
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "machines_org_members_all" on public.machines;
create policy "machines_org_members_all" on public.machines
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "machine_usage_org_members_all" on public.machine_usage;
create policy "machine_usage_org_members_all" on public.machine_usage
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "daily_progress_org_members_all" on public.daily_progress;
create policy "daily_progress_org_members_all" on public.daily_progress
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "project_alerts_org_members_all" on public.project_alerts;
create policy "project_alerts_org_members_all" on public.project_alerts
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());
