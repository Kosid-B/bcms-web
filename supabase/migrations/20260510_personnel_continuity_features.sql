-- ISO 22330/22331 aligned personnel continuity feature set
-- PLAN -> DO -> CHECK -> ACT data model and scoring

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_code text not null,
  unit_name text not null,
  parent_unit_id uuid references public.org_units(id) on delete set null,
  criticality integer not null default 3 check (criticality between 1 and 5),
  minimum_capacity_pct integer not null default 60 check (minimum_capacity_pct between 0 and 100),
  target_rto_minutes integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, unit_code)
);

create table if not exists public.personnel_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  unit_id uuid references public.org_units(id) on delete set null,
  full_name text not null,
  employment_type text not null default 'employee',
  status text not null default 'active',
  email text,
  phone text,
  seniority_level text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personnel_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.org_units(id) on delete set null,
  role_name text not null,
  role_code text,
  role_type text not null default 'operational',
  criticality integer not null default 3 check (criticality between 1 and 5),
  min_headcount integer not null default 1,
  target_headcount integer not null default 1,
  max_absence_pct integer not null default 30 check (max_absence_pct between 0 and 100),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, role_name)
);

create table if not exists public.personnel_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.personnel_profiles(id) on delete cascade,
  role_id uuid not null references public.personnel_roles(id) on delete cascade,
  is_primary boolean not null default true,
  backup_priority integer,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default timezone('utc', now()),
  unique (person_id, role_id, effective_from)
);

create table if not exists public.personnel_competencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  competency_name text not null,
  category text,
  required_level integer not null default 3 check (required_level between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  unique (org_id, code)
);

create table if not exists public.personnel_competency_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.personnel_profiles(id) on delete cascade,
  competency_id uuid not null references public.personnel_competencies(id) on delete cascade,
  level integer not null default 0 check (level between 0 and 5),
  evidence_type text not null default 'assessment',
  verified_at timestamptz,
  expiry_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (person_id, competency_id, evidence_type)
);

create table if not exists public.personnel_training_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.org_units(id) on delete set null,
  training_name text not null,
  training_type text not null default 'awareness',
  cadence text not null default 'annual',
  required_participants integer not null default 1,
  completed_participants integer not null default 0,
  due_date date,
  completed_date date,
  status text not null default 'planned',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personnel_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.org_units(id) on delete set null,
  source text not null default 'exercise',
  title text not null,
  description text,
  owner_person_id uuid references public.personnel_profiles(id) on delete set null,
  due_date date,
  status text not null default 'open',
  severity integer not null default 3 check (severity between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz
);

create index if not exists org_units_org_idx on public.org_units(org_id);
create index if not exists personnel_profiles_org_idx on public.personnel_profiles(org_id);
create index if not exists personnel_profiles_unit_idx on public.personnel_profiles(unit_id);
create index if not exists personnel_roles_org_idx on public.personnel_roles(org_id);
create index if not exists personnel_roles_unit_idx on public.personnel_roles(unit_id);
create index if not exists personnel_assignments_org_idx on public.personnel_assignments(org_id);
create index if not exists personnel_assignments_person_idx on public.personnel_assignments(person_id);
create index if not exists personnel_competency_evidence_org_idx on public.personnel_competency_evidence(org_id);
create index if not exists personnel_training_cycles_org_idx on public.personnel_training_cycles(org_id);
create index if not exists personnel_improvement_actions_org_idx on public.personnel_improvement_actions(org_id);

drop trigger if exists trg_org_units_updated_at on public.org_units;
create trigger trg_org_units_updated_at before update on public.org_units
for each row execute function public.touch_updated_at();

drop trigger if exists trg_personnel_profiles_updated_at on public.personnel_profiles;
create trigger trg_personnel_profiles_updated_at before update on public.personnel_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_personnel_roles_updated_at on public.personnel_roles;
create trigger trg_personnel_roles_updated_at before update on public.personnel_roles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_personnel_competency_evidence_updated_at on public.personnel_competency_evidence;
create trigger trg_personnel_competency_evidence_updated_at before update on public.personnel_competency_evidence
for each row execute function public.touch_updated_at();

drop trigger if exists trg_personnel_training_cycles_updated_at on public.personnel_training_cycles;
create trigger trg_personnel_training_cycles_updated_at before update on public.personnel_training_cycles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_personnel_improvement_actions_updated_at on public.personnel_improvement_actions;
create trigger trg_personnel_improvement_actions_updated_at before update on public.personnel_improvement_actions
for each row execute function public.touch_updated_at();

create or replace function public.personnel_role_coverage(p_org_id uuid, p_role_id uuid)
returns numeric
language sql
stable
as $$
  with role_target as (
    select greatest(min_headcount, 1)::numeric as target_hc
    from public.personnel_roles
    where id = p_role_id and org_id = p_org_id
  ),
  active_people as (
    select count(distinct a.person_id)::numeric as assigned_hc
    from public.personnel_assignments a
    join public.personnel_profiles p on p.id = a.person_id
    where a.org_id = p_org_id
      and a.role_id = p_role_id
      and (a.effective_to is null or a.effective_to >= current_date)
      and p.status = 'active'
  )
  select coalesce(round((active_people.assigned_hc / role_target.target_hc) * 100, 2), 0)
  from role_target, active_people;
$$;

create or replace function public.evaluate_personnel_readiness(p_org_id uuid, p_unit_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_roles integer := 0;
  covered_roles integer := 0;
  total_trainings integer := 0;
  ontime_trainings integer := 0;
  open_actions integer := 0;
  overdue_actions integer := 0;
  avg_competency numeric := 0;
  target_competency numeric := 3;
  role_coverage_score numeric := 0;
  training_score numeric := 0;
  action_score numeric := 0;
  competency_score numeric := 0;
  final_score numeric := 0;
begin
  select count(*)
  into total_roles
  from public.personnel_roles r
  where r.org_id = p_org_id
    and (p_unit_id is null or r.unit_id = p_unit_id);

  select count(*)
  into covered_roles
  from public.personnel_roles r
  where r.org_id = p_org_id
    and (p_unit_id is null or r.unit_id = p_unit_id)
    and public.personnel_role_coverage(p_org_id, r.id) >= 100;

  select count(*),
         count(*) filter (where status = 'completed' and (completed_date is null or due_date is null or completed_date <= due_date))
  into total_trainings, ontime_trainings
  from public.personnel_training_cycles t
  where t.org_id = p_org_id
    and (p_unit_id is null or t.unit_id = p_unit_id);

  select count(*),
         count(*) filter (where status <> 'closed' and due_date is not null and due_date < current_date)
  into open_actions, overdue_actions
  from public.personnel_improvement_actions a
  where a.org_id = p_org_id
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and a.status <> 'closed';

  select coalesce(avg(e.level), 0), coalesce(avg(c.required_level), 3)
  into avg_competency, target_competency
  from public.personnel_competency_evidence e
  join public.personnel_competencies c on c.id = e.competency_id
  join public.personnel_profiles p on p.id = e.person_id
  where e.org_id = p_org_id
    and (p_unit_id is null or p.unit_id = p_unit_id);

  role_coverage_score := case when total_roles = 0 then 0 else (covered_roles::numeric / total_roles::numeric) * 100 end;
  training_score := case when total_trainings = 0 then 0 else (ontime_trainings::numeric / total_trainings::numeric) * 100 end;
  action_score := case when open_actions = 0 then 100 else greatest(0, 100 - ((overdue_actions::numeric / open_actions::numeric) * 100)) end;
  competency_score := case when target_competency = 0 then 0 else least(100, (avg_competency / target_competency) * 100) end;

  final_score := round(
    (role_coverage_score * 0.35) +
    (training_score * 0.25) +
    (competency_score * 0.25) +
    (action_score * 0.15)
  , 2);

  return jsonb_build_object(
    'org_id', p_org_id,
    'unit_id', p_unit_id,
    'readiness_score', final_score,
    'breakdown', jsonb_build_object(
      'role_coverage_score', round(role_coverage_score, 2),
      'training_score', round(training_score, 2),
      'competency_score', round(competency_score, 2),
      'action_score', round(action_score, 2)
    ),
    'metrics', jsonb_build_object(
      'total_roles', total_roles,
      'covered_roles', covered_roles,
      'total_trainings', total_trainings,
      'ontime_trainings', ontime_trainings,
      'open_actions', open_actions,
      'overdue_actions', overdue_actions
    ),
    'maturity_level', case
      when final_score >= 85 then 'optimized'
      when final_score >= 70 then 'managed'
      when final_score >= 50 then 'defined'
      when final_score >= 30 then 'developing'
      else 'initial'
    end
  );
end;
$$;

drop view if exists public.personnel_readiness_snapshot;
create view public.personnel_readiness_snapshot as
select
  o.id as org_id,
  o.name as org_name,
  public.evaluate_personnel_readiness(o.id, null) as readiness
from public.organizations o;

alter table public.org_units enable row level security;
alter table public.personnel_profiles enable row level security;
alter table public.personnel_roles enable row level security;
alter table public.personnel_assignments enable row level security;
alter table public.personnel_competencies enable row level security;
alter table public.personnel_competency_evidence enable row level security;
alter table public.personnel_training_cycles enable row level security;
alter table public.personnel_improvement_actions enable row level security;

drop policy if exists "org_units_org_members_all" on public.org_units;
create policy "org_units_org_members_all" on public.org_units
for all to authenticated
using (org_id = public.current_org_id() and public.has_department_access(org_id, unit_name))
with check (org_id = public.current_org_id() and public.has_department_access(org_id, unit_name));

drop policy if exists "personnel_profiles_org_members_all" on public.personnel_profiles;
create policy "personnel_profiles_org_members_all" on public.personnel_profiles
for all to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or exists (
      select 1
      from public.org_units u
      where u.id = personnel_profiles.unit_id
        and public.has_department_access(org_id, u.unit_name)
    )
  )
)
with check (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or exists (
      select 1
      from public.org_units u
      where u.id = personnel_profiles.unit_id
        and public.has_department_access(org_id, u.unit_name)
    )
  )
);

drop policy if exists "personnel_roles_org_members_all" on public.personnel_roles;
create policy "personnel_roles_org_members_all" on public.personnel_roles
for all to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or exists (
      select 1 from public.org_units u
      where u.id = personnel_roles.unit_id
        and public.has_department_access(org_id, u.unit_name)
    )
  )
)
with check (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or exists (
      select 1 from public.org_units u
      where u.id = personnel_roles.unit_id
        and public.has_department_access(org_id, u.unit_name)
    )
  )
);

drop policy if exists "personnel_assignments_org_members_all" on public.personnel_assignments;
create policy "personnel_assignments_org_members_all" on public.personnel_assignments
for all to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.personnel_roles r
    left join public.org_units u on u.id = r.unit_id
    where r.id = personnel_assignments.role_id
      and r.org_id = personnel_assignments.org_id
      and (
        public.is_org_admin()
        or public.has_department_access(r.org_id, u.unit_name)
      )
  )
)
with check (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.personnel_roles r
    left join public.org_units u on u.id = r.unit_id
    where r.id = personnel_assignments.role_id
      and r.org_id = personnel_assignments.org_id
      and (
        public.is_org_admin()
        or public.has_department_access(r.org_id, u.unit_name)
      )
  )
);

drop policy if exists "personnel_competencies_org_members_all" on public.personnel_competencies;
create policy "personnel_competencies_org_members_all" on public.personnel_competencies
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "personnel_competency_evidence_org_members_all" on public.personnel_competency_evidence;
create policy "personnel_competency_evidence_org_members_all" on public.personnel_competency_evidence
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "personnel_training_cycles_org_members_all" on public.personnel_training_cycles;
create policy "personnel_training_cycles_org_members_all" on public.personnel_training_cycles
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "personnel_improvement_actions_org_members_all" on public.personnel_improvement_actions;
create policy "personnel_improvement_actions_org_members_all" on public.personnel_improvement_actions
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

