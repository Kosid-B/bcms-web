-- Ensure every new signup gets a 14-day free trial and existing free orgs are normalized.

-- 1) Keep default status for new subscription rows.
alter table if exists public.subscriptions
  alter column status set default 'trialing';

-- 2) Ensure trial end timestamp exists and defaults to now + 14 days.
alter table if exists public.subscriptions
  add column if not exists trial_ends_at timestamptz;

alter table if exists public.subscriptions
  alter column trial_ends_at set default (timezone('utc', now()) + interval '14 day');

-- 3) Normalize existing free/trial rows that have missing or invalid trial dates.
update public.subscriptions s
set
  status = coalesce(nullif(s.status, ''), 'trialing'),
  trial_ends_at = coalesce(
    s.trial_ends_at,
    s.current_period_end,
    s.created_at + interval '14 day',
    timezone('utc', now()) + interval '14 day'
  )
where s.plan = 'free'
  and (
    s.status is null
    or s.status = ''
    or s.status = 'trialing'
    or s.trial_ends_at is null
  );

-- 4) Guarantee signup trigger inserts free trial rows (idempotent).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_full_name text;
  raw_org_name text;
  generated_subdomain text;
  new_org_id uuid;
begin
  raw_full_name := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'ผู้ใช้ใหม่');
  raw_org_name := coalesce(new.raw_user_meta_data ->> 'org', raw_full_name || ' Organization');

  generated_subdomain := lower(regexp_replace(raw_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  generated_subdomain := trim(both '-' from generated_subdomain);
  generated_subdomain := coalesce(nullif(generated_subdomain, ''), 'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  generated_subdomain := left(generated_subdomain, 38);

  while exists(select 1 from public.organizations o where o.subdomain = generated_subdomain) loop
    generated_subdomain := left(generated_subdomain, 32) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end loop;

  insert into public.organizations (name, subdomain, billing_email)
  values (raw_org_name, generated_subdomain, new.email)
  returning id into new_org_id;

  insert into public.org_branding (org_id, company_name)
  values (new_org_id, raw_org_name)
  on conflict (org_id) do update set company_name = excluded.company_name;

  insert into public.profiles (id, org_id, full_name, display_name, phone, role)
  values (
    new.id,
    new_org_id,
    raw_full_name,
    raw_full_name,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'owner'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (
    org_id,
    plan,
    status,
    billing,
    amount_thb,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  values (
    new_org_id,
    'free',
    'trialing',
    'monthly',
    0,
    timezone('utc', now()) + interval '14 day',
    timezone('utc', now()),
    timezone('utc', now()) + interval '14 day'
  )
  on conflict (org_id) do update
  set
    plan = excluded.plan,
    status = excluded.status,
    trial_ends_at = coalesce(public.subscriptions.trial_ends_at, excluded.trial_ends_at),
    current_period_start = coalesce(public.subscriptions.current_period_start, excluded.current_period_start),
    current_period_end = coalesce(public.subscriptions.current_period_end, excluded.current_period_end);

  return new;
end;
$$;
