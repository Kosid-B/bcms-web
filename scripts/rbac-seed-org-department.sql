-- RBAC seed data for testing org-level vs department-level access
-- Usage:
-- 1) Open Supabase SQL Editor
-- 2) Replace the 3 email values below with real users in auth.users
-- 3) Run the script

begin;

-- ===== configurable inputs =====
do $$
declare
  v_org_name text := 'RBAC Test Organization';
  v_org_subdomain text := 'rbac-test-org';

  -- Replace these with real users already registered in your project.
  v_owner_email text := 'buffkosid@gmail.com';
  v_it_email text := 'support@b-tctraining.com';
  v_finance_email text := 'keawtao2520@gmail.com';

  v_org_id uuid;
  v_owner_id uuid;
  v_it_id uuid;
  v_finance_id uuid;
  has_org_subdomain boolean;
  has_org_billing_email boolean;
begin
  select id into v_owner_id from auth.users where email = v_owner_email limit 1;
  select id into v_it_id from auth.users where email = v_it_email limit 1;
  select id into v_finance_id from auth.users where email = v_finance_email limit 1;

  if v_owner_id is null then
    raise exception 'Owner user not found for email: %', v_owner_email;
  end if;
  if v_it_id is null then
    raise exception 'IT user not found for email: %', v_it_email;
  end if;
  if v_finance_id is null then
    raise exception 'Finance user not found for email: %', v_finance_email;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'subdomain'
  ) into has_org_subdomain;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'billing_email'
  ) into has_org_billing_email;

  if has_org_subdomain and has_org_billing_email then
    insert into public.organizations (name, subdomain, billing_email)
    values (v_org_name, v_org_subdomain, v_owner_email)
    on conflict (subdomain) do update set
      name = excluded.name,
      billing_email = excluded.billing_email
    returning id into v_org_id;
  elsif has_org_subdomain then
    insert into public.organizations (name, subdomain)
    values (v_org_name, v_org_subdomain)
    on conflict (subdomain) do update set
      name = excluded.name
    returning id into v_org_id;
  else
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org_id;
  end if;

  insert into public.org_branding (org_id, company_name)
  values (v_org_id, v_org_name)
  on conflict (org_id) do update set company_name = excluded.company_name;

  if to_regclass('public.subscriptions') is not null then
    begin
      insert into public.subscriptions (org_id, plan)
      values (v_org_id, 'professional')
      on conflict (org_id) do update set
        plan = excluded.plan;
    exception when others then
      null;
    end;
  end if;

  -- Org-level admin
  insert into public.profiles (id, org_id, full_name, role)
  values (v_owner_id, v_org_id, 'RBAC Owner', 'owner')
  on conflict (id) do update set
    org_id = excluded.org_id,
    role = excluded.role;

  -- Department-level: IT
  insert into public.profiles (id, org_id, full_name, role)
  values (v_it_id, v_org_id, 'RBAC IT User', 'member')
  on conflict (id) do update set
    org_id = excluded.org_id,
    role = excluded.role;

  -- Department-level: Finance
  insert into public.profiles (id, org_id, full_name, role)
  values (v_finance_id, v_org_id, 'RBAC Finance User', 'member')
  on conflict (id) do update set
    org_id = excluded.org_id,
    role = excluded.role;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'access_level'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'department'
    ) then
      update public.profiles
      set access_level = 'org', department = null
      where id = v_owner_id;

      update public.profiles
      set access_level = 'department', department = 'IT'
      where id = v_it_id;

      update public.profiles
      set access_level = 'department', department = 'Finance'
      where id = v_finance_id;
    else
      update public.profiles set access_level = 'org' where id = v_owner_id;
      update public.profiles set access_level = 'department' where id = v_it_id;
      update public.profiles set access_level = 'department' where id = v_finance_id;
    end if;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'department'
  ) then
    update public.profiles set department = null where id = v_owner_id;
    update public.profiles set department = 'IT' where id = v_it_id;
    update public.profiles set department = 'Finance' where id = v_finance_id;
  end if;

  -- Seed BIA by department
  if to_regclass('public.bia_processes') is not null then
    begin
      insert into public.bia_processes (org_id, name, department, owner, status, criticality, mac_pct, current_capacity_pct, rto_minutes, rpo_minutes)
      values
        (v_org_id, 'IT DR Recovery', 'IT', 'IT Manager', 'approved', 5, 40, 100, 240, 60),
        (v_org_id, 'Finance Payment Ops', 'Finance', 'Finance Manager', 'approved', 4, 50, 100, 480, 120)
      on conflict do nothing;
    exception when others then
      null;
    end;
  end if;

  -- Seed resources by department
  if to_regclass('public.resources') is not null then
    begin
      insert into public.resources (org_id, resource_type, name, department, criticality, unit)
      values
        (v_org_id, 'system', 'Primary ERP', 'IT', 5, 'system'),
        (v_org_id, 'people', 'AR Accountant', 'Finance', 4, 'person')
      on conflict do nothing;
    exception when others then
      null;
    end;
  end if;

  raise notice 'RBAC seed completed. org_id=%', v_org_id;
end $$;

commit;
