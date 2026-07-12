-- ============================================================
-- Super Admin Subscription Bypass
-- support@b-tctraining.com เข้าใช้ได้โดยไม่ต้องจ่ายเงิน
-- ============================================================

-- 1. Centralised super-admin email list (single source of truth)
create or replace function public.is_super_admin_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(p_email) = any(array[
    'support@b-tctraining.com',
    'admin@b-tctraining.com'
  ]);
$$;

-- 2. Update is_super_admin() to use the shared helper
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
      and public.is_super_admin_email(email)
  );
$$;

-- 3. Patch handle_new_user() — super admins get enterprise/active at signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  raw_org_name text;
  raw_full_name text;
  generated_subdomain text;
  v_is_super_admin boolean;
begin
  raw_org_name       := coalesce(new.raw_user_meta_data ->> 'org_name', split_part(new.email, '@', 1) || ' workspace');
  raw_full_name      := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  generated_subdomain := left(public.slugify(raw_org_name), 40);
  v_is_super_admin   := public.is_super_admin_email(new.email);

  if generated_subdomain is null or generated_subdomain = '' then
    generated_subdomain := 'workspace';
  end if;

  while exists(select 1 from public.organizations where subdomain = generated_subdomain) loop
    generated_subdomain := left(generated_subdomain, 32) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end loop;

  insert into public.organizations (name, subdomain, billing_email)
  values (raw_org_name, generated_subdomain, new.email)
  returning id into new_org_id;

  insert into public.org_branding (org_id, company_name)
  values (new_org_id, raw_org_name);

  insert into public.profiles (id, org_id, full_name, display_name, phone, role)
  values (
    new.id,
    new_org_id,
    raw_full_name,
    raw_full_name,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when v_is_super_admin then 'owner' else 'owner' end
  );

  insert into public.subscriptions (
    org_id, plan, status, billing, amount_thb,
    current_period_start, current_period_end, trial_ends_at
  )
  values (
    new_org_id,
    case when v_is_super_admin then 'enterprise' else 'free' end,
    case when v_is_super_admin then 'active'     else 'trialing' end,
    'monthly',
    0,
    case when v_is_super_admin then now()      else null end,
    case when v_is_super_admin then now() + interval '100 years' else null end,
    case when v_is_super_admin then null else now() + interval '14 days' end
  );

  return new;
end;
$$;

-- 4. Update existing super-admin accounts (if already signed up)
update public.subscriptions s
set
  plan                 = 'enterprise',
  status               = 'active',
  current_period_start = now(),
  current_period_end   = now() + interval '100 years',
  trial_ends_at        = null,
  updated_at           = now()
where s.org_id in (
  select p.org_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_super_admin_email(u.email)
);
