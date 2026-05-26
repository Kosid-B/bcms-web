-- 1. สร้างฟังก์ชันตรวจสอบสิทธิ์ Super Admin (Buff Admin)
-- ตรวจสอบจาก email domain หรือ email เฉพาะเจาะจง
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 
    from auth.users 
    where id = auth.uid() 
      and email in (
        'support@b-tctraining.com'
        -- เพิ่มอีเมลที่ได้รับอนุญาตที่นี่แบบเฉพาะเจาะจง
      )
  );
$$;

-- 2. ปรับปรุง RLS ของตาราง Organizations ให้ Super Admin เห็นทั้งหมด
drop policy if exists "organizations_org_members_select" on public.organizations;
create policy "organizations_org_members_select" on public.organizations
for select to authenticated
using (
  public.is_super_admin() 
  or id = public.current_org_id()
);

-- 3. ปรับปรุง RLS ของตาราง Profiles ให้ Super Admin เห็นทั้งหมด
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select to authenticated
using (
  public.is_super_admin()
  or org_id = public.current_org_id()
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

-- 4. ปรับปรุง RLS ของตาราง Subscriptions ให้ Super Admin เห็นทั้งหมด
drop policy if exists "subscriptions_org_members_select" on public.subscriptions;
create policy "subscriptions_org_members_select" on public.subscriptions
for select to authenticated
using (
  public.is_super_admin()
  or org_id = public.current_org_id()
);

-- 5. ปรับปรุง RLS ของตาราง Payment Orders ให้ Super Admin เห็นและจัดการได้ทั้งหมด
drop policy if exists "payment_orders_org_members_select" on public.payment_orders;
create policy "payment_orders_org_members_select" on public.payment_orders
for select to authenticated
using (
  public.is_super_admin()
  or org_id = public.current_org_id()
);

-- 6. ปรับปรุง RLS ของตาราง BIA Processes ให้ Super Admin เห็นทั้งหมด
drop policy if exists "bia_processes_org_members_all" on public.bia_processes;
create policy "bia_processes_org_members_all" on public.bia_processes
for all to authenticated
using (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and public.has_department_access(org_id, department)
  )
)
with check (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and public.has_department_access(org_id, department)
  )
);

-- 7. ปรับปรุง RLS ของตาราง BC Plans ให้ Super Admin เห็นทั้งหมด
drop policy if exists "bc_plans_org_members_all" on public.bc_plans;
create policy "bc_plans_org_members_all" on public.bc_plans
for all to authenticated
using (
  public.is_super_admin()
  or (
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
)
with check (
  public.is_super_admin()
  or (
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
);

-- 8. ปรับปรุง RLS ของตาราง Resources ให้ Super Admin เห็นทั้งหมด
drop policy if exists "resources_org_members_all" on public.resources;
create policy "resources_org_members_all" on public.resources
for all to authenticated
using (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and public.has_department_access(org_id, department)
  )
)
with check (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and public.has_department_access(org_id, department)
  )
);

-- 9. ปรับปรุง RLS ของตาราง Process Resources
drop policy if exists "process_resources_org_members_all" on public.process_resources;
create policy "process_resources_org_members_all" on public.process_resources
for all to authenticated
using (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and exists (
      select 1
      from public.bia_processes p
      where p.id = process_resources.process_id
        and p.org_id = process_resources.org_id
        and public.has_department_access(p.org_id, p.department)
    )
  )
)
with check (
  public.is_super_admin()
  or (
    org_id = public.current_org_id()
    and exists (
      select 1
      from public.bia_processes p
      where p.id = process_resources.process_id
        and p.org_id = process_resources.org_id
        and public.has_department_access(p.org_id, p.department)
    )
  )
);

-- 10. ปรับปรุง RLS ของตาราง Org Branding
drop policy if exists "org_branding_org_members_all" on public.org_branding;
create policy "org_branding_org_members_all" on public.org_branding
for all to authenticated
using (
  public.is_super_admin()
  or org_id = public.current_org_id()
)
with check (
  public.is_super_admin()
  or org_id = public.current_org_id()
);

-- 11. ปรับปรุง RLS ของตาราง PLG Events
drop policy if exists "plg_events_org_members_select" on public.plg_events;
create policy "plg_events_org_members_select" on public.plg_events
for select to authenticated
using (
  public.is_super_admin()
  or org_id = public.current_org_id()
);
