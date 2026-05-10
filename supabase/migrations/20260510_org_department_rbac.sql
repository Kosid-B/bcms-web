alter table public.profiles
  add column if not exists access_level text not null default 'org'
  check (access_level in ('org', 'department'));

alter table public.profiles
  add column if not exists department text;

create index if not exists profiles_org_department_idx on public.profiles(org_id, department);
create index if not exists profiles_org_access_level_idx on public.profiles(org_id, access_level);

alter table public.bc_plans add column if not exists department text;
create index if not exists bc_plans_org_department_idx on public.bc_plans(org_id, department);

update public.profiles
set access_level = case
  when coalesce(role, '') in ('owner', 'admin') then 'org'
  else 'department'
end
where access_level is null
   or access_level not in ('org', 'department');

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_access_level()
returns text
language sql
stable
as $$
  select access_level from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_department()
returns text
language sql
stable
as $$
  select department from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role(), '') in ('owner', 'admin');
$$;

create or replace function public.has_department_access(target_org_id uuid, target_department text)
returns boolean
language sql
stable
as $$
  with me as (
    select
      p.org_id,
      coalesce(p.role, '') as role_name,
      coalesce(p.access_level, 'org') as access_level_name,
      nullif(lower(trim(coalesce(p.department, ''))), '') as department_key
    from public.profiles p
    where p.id = auth.uid()
  ),
  target as (
    select nullif(lower(trim(coalesce(target_department, ''))), '') as department_key
  )
  select exists (
    select 1
    from me
    cross join target
    where me.org_id = target_org_id
      and (
        me.role_name in ('owner', 'admin')
        or me.access_level_name = 'org'
        or (
          me.access_level_name = 'department'
          and me.department_key is not null
          and target.department_key is not null
          and me.department_key = target.department_key
        )
      )
  );
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or id = auth.uid()
    or (
      coalesce(public.current_user_access_level(), 'org') = 'department'
      and nullif(lower(trim(coalesce(public.current_user_department(), ''))), '') is not null
      and nullif(lower(trim(coalesce(department, ''))), '') =
          nullif(lower(trim(coalesce(public.current_user_department(), ''))), '')
    )
  )
);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or id = auth.uid()
  )
)
with check (
  org_id = public.current_org_id()
  and (
    public.is_org_admin()
    or id = auth.uid()
  )
);

drop policy if exists "bia_processes_org_members_all" on public.bia_processes;
create policy "bia_processes_org_members_all" on public.bia_processes
for all to authenticated
using (
  org_id = public.current_org_id()
  and public.has_department_access(org_id, department)
)
with check (
  org_id = public.current_org_id()
  and public.has_department_access(org_id, department)
);

drop policy if exists "resources_org_members_all" on public.resources;
create policy "resources_org_members_all" on public.resources
for all to authenticated
using (
  org_id = public.current_org_id()
  and public.has_department_access(org_id, department)
)
with check (
  org_id = public.current_org_id()
  and public.has_department_access(org_id, department)
);

drop policy if exists "bc_plans_org_members_all" on public.bc_plans;
create policy "bc_plans_org_members_all" on public.bc_plans
for all to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.has_department_access(org_id, department)
    or (
      process_id is not null
      and exists (
        select 1
        from public.bia_processes p
        where p.id = bc_plans.process_id
          and p.org_id = bc_plans.org_id
          and public.has_department_access(p.org_id, p.department)
      )
    )
  )
)
with check (
  org_id = public.current_org_id()
  and (
    public.has_department_access(org_id, department)
    or (
      process_id is not null
      and exists (
        select 1
        from public.bia_processes p
        where p.id = bc_plans.process_id
          and p.org_id = bc_plans.org_id
          and public.has_department_access(p.org_id, p.department)
      )
    )
  )
);

drop policy if exists "process_resources_org_members_all" on public.process_resources;
create policy "process_resources_org_members_all" on public.process_resources
for all to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.bia_processes p
    where p.id = process_resources.process_id
      and p.org_id = process_resources.org_id
      and public.has_department_access(p.org_id, p.department)
  )
)
with check (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.bia_processes p
    where p.id = process_resources.process_id
      and p.org_id = process_resources.org_id
      and public.has_department_access(p.org_id, p.department)
  )
);
