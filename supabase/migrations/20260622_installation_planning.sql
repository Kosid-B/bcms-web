-- Installation planning for pole projects.
-- Managers create teams, plans, and points. Team leaders only read assigned work.

create table if not exists public.project_teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  team_type text not null default 'installation'
    check (team_type in ('installation', 'foundation', 'inspection', 'transport')),
  leader_profile_id uuid references public.profiles(id) on delete set null,
  leader_name text not null,
  crew_size integer not null default 1 check (crew_size > 0),
  assigned_work text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, project_id, name)
);

create table if not exists public.installation_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  area_name text not null,
  province text not null,
  start_date date,
  end_date date,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'in_progress', 'completed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, project_id, name)
);

create table if not exists public.installation_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_id uuid not null references public.installation_plans(id) on delete cascade,
  team_id uuid references public.project_teams(id) on delete restrict,
  point_code text,
  name text not null,
  location_text text not null,
  province text not null,
  district text,
  subdistrict text,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  assigned_date date,
  target_units integer not null default 0 check (target_units >= 0),
  assigned_work text not null,
  notes text,
  status text not null default 'planned'
    check (status in ('planned', 'assigned', 'in_progress', 'done', 'blocked')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, point_code)
);

create unique index if not exists project_teams_org_project_id_idx
  on public.project_teams(org_id, project_id, id);
create unique index if not exists installation_plans_org_project_id_idx
  on public.installation_plans(org_id, project_id, id);
create index if not exists project_teams_org_active_idx
  on public.project_teams(org_id, is_active, project_id);
create index if not exists project_teams_leader_idx
  on public.project_teams(leader_profile_id, is_active);
create index if not exists installation_plans_org_status_idx
  on public.installation_plans(org_id, status, start_date);
create index if not exists installation_points_plan_idx
  on public.installation_points(plan_id, assigned_date);
create index if not exists installation_points_team_status_idx
  on public.installation_points(team_id, status, assigned_date);
create index if not exists installation_points_geo_idx
  on public.installation_points(province, district);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_teams_org_project_fk'
      and conrelid = 'public.project_teams'::regclass
  ) then
    alter table public.project_teams
      add constraint project_teams_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'installation_plans_org_project_fk'
      and conrelid = 'public.installation_plans'::regclass
  ) then
    alter table public.installation_plans
      add constraint installation_plans_org_project_fk
      foreign key (org_id, project_id)
      references public.projects(org_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'installation_points_org_plan_fk'
      and conrelid = 'public.installation_points'::regclass
  ) then
    alter table public.installation_points
      add constraint installation_points_org_plan_fk
      foreign key (org_id, project_id, plan_id)
      references public.installation_plans(org_id, project_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'installation_points_org_team_fk'
      and conrelid = 'public.installation_points'::regclass
  ) then
    alter table public.installation_points
      add constraint installation_points_org_team_fk
      foreign key (org_id, project_id, team_id)
      references public.project_teams(org_id, project_id, id)
      on delete restrict;
  end if;
end;
$$;

drop trigger if exists trg_project_teams_updated_at on public.project_teams;
create trigger trg_project_teams_updated_at
before update on public.project_teams
for each row execute function public.touch_updated_at();

drop trigger if exists trg_installation_plans_updated_at on public.installation_plans;
create trigger trg_installation_plans_updated_at
before update on public.installation_plans
for each row execute function public.touch_updated_at();

drop trigger if exists trg_installation_points_updated_at on public.installation_points;
create trigger trg_installation_points_updated_at
before update on public.installation_points
for each row execute function public.touch_updated_at();

create or replace function public.can_manage_installation_planning()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role in ('owner', 'admin', 'executive', 'super_admin')
    from public.profiles
    where id = auth.uid()
  ), false);
$$;

revoke all on function public.can_manage_installation_planning() from public;
grant execute on function public.can_manage_installation_planning() to authenticated;

create or replace function public.can_view_installation_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_installation_planning()
    or exists (
      select 1
      from public.installation_points point
      join public.project_teams team on team.id = point.team_id
      where point.plan_id = p_plan_id
        and point.org_id = public.current_org_id()
        and team.org_id = point.org_id
        and team.project_id = point.project_id
        and team.leader_profile_id = auth.uid()
        and team.is_active = true
    );
$$;


revoke all on function public.can_view_installation_plan(uuid) from public;
grant execute on function public.can_view_installation_plan(uuid) to authenticated;

alter table public.project_teams enable row level security;
alter table public.installation_plans enable row level security;
alter table public.installation_points enable row level security;

drop policy if exists "project_teams_visible_to_manager_or_leader" on public.project_teams;
create policy "project_teams_visible_to_manager_or_leader" on public.project_teams
for select to authenticated
using (
  org_id = public.current_org_id()
  and (public.can_manage_installation_planning() or leader_profile_id = auth.uid())
);

drop policy if exists "project_teams_org_manager_manage" on public.project_teams;
create policy "project_teams_org_manager_manage" on public.project_teams
for all to authenticated
using (org_id = public.current_org_id() and public.can_manage_installation_planning())
with check (org_id = public.current_org_id() and public.can_manage_installation_planning());

drop policy if exists "installation_plans_visible_to_manager_or_assigned_leader" on public.installation_plans;
create policy "installation_plans_visible_to_manager_or_assigned_leader" on public.installation_plans
for select to authenticated
using (
  org_id = public.current_org_id()
  and public.can_view_installation_plan(id)
);

drop policy if exists "installation_plans_org_manager_manage" on public.installation_plans;
create policy "installation_plans_org_manager_manage" on public.installation_plans
for all to authenticated
using (org_id = public.current_org_id() and public.can_manage_installation_planning())
with check (org_id = public.current_org_id() and public.can_manage_installation_planning());

drop policy if exists "installation_points_visible_to_manager_or_assigned_leader" on public.installation_points;
create policy "installation_points_visible_to_manager_or_assigned_leader" on public.installation_points
for select to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.can_manage_installation_planning()
    or exists (
      select 1
      from public.project_teams team
      where team.id = team_id
        and team.org_id = installation_points.org_id
        and team.project_id = installation_points.project_id
        and team.leader_profile_id = auth.uid()
        and team.is_active = true
    )
  )
);

drop policy if exists "installation_points_org_manager_manage" on public.installation_points;
create policy "installation_points_org_manager_manage" on public.installation_points
for all to authenticated
using (org_id = public.current_org_id() and public.can_manage_installation_planning())
with check (org_id = public.current_org_id() and public.can_manage_installation_planning());
