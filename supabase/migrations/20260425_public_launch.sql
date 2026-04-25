create extension if not exists pgcrypto;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  subdomain text unique,
  custom_domain text unique,
  plan text not null default 'free',
  status text not null default 'trialing',
  timezone text not null default 'Asia/Bangkok',
  max_seats integer not null default 3,
  features jsonb not null default '{}'::jsonb,
  billing_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.org_branding (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  primary_color text not null default '#1565C0',
  company_name text,
  tagline text,
  logo_url text,
  favicon_url text,
  custom_domain text unique,
  footer_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  display_name text,
  phone text,
  role text not null default 'owner',
  bcm_role text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'trialing',
  billing text not null default 'monthly',
  amount_thb integer not null default 0,
  currency text not null default 'THB',
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz default timezone('utc', now()) + interval '14 day',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  plan text not null,
  billing text not null default 'monthly',
  amount_thb integer not null default 0,
  currency text not null default 'THB',
  status text not null default 'pending',
  slip_url text,
  slip_name text,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plg_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists organizations_subdomain_idx on public.organizations(subdomain);
create index if not exists organizations_custom_domain_idx on public.organizations(custom_domain);
create index if not exists profiles_org_id_idx on public.profiles(org_id);
create index if not exists payment_orders_org_id_idx on public.payment_orders(org_id);
create index if not exists payment_orders_status_idx on public.payment_orders(status);
create index if not exists plg_events_org_id_idx on public.plg_events(org_id);
create index if not exists plg_events_event_name_idx on public.plg_events(event_name);

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.touch_updated_at();

drop trigger if exists trg_org_branding_updated_at on public.org_branding;
create trigger trg_org_branding_updated_at
before update on public.org_branding
for each row execute function public.touch_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_payment_orders_updated_at on public.payment_orders;
create trigger trg_payment_orders_updated_at
before update on public.payment_orders
for each row execute function public.touch_updated_at();

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
begin
  raw_org_name := coalesce(new.raw_user_meta_data ->> 'org_name', split_part(new.email, '@', 1) || ' workspace');
  raw_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  generated_subdomain := left(public.slugify(raw_org_name), 40);

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
    'owner'
  );

  insert into public.subscriptions (org_id, plan, status, billing, amount_thb)
  values (new_org_id, 'free', 'trialing', 'monthly', 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.org_branding enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.plg_events enable row level security;

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select to authenticated
using (id = auth.uid() or org_id = public.current_org_id());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update to authenticated
using (id = auth.uid() or org_id = public.current_org_id())
with check (id = auth.uid() or org_id = public.current_org_id());

drop policy if exists "organizations_org_members_select" on public.organizations;
create policy "organizations_org_members_select" on public.organizations
for select to authenticated
using (id = public.current_org_id());

drop policy if exists "org_branding_org_members_all" on public.org_branding;
create policy "org_branding_org_members_all" on public.org_branding
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "subscriptions_org_members_select" on public.subscriptions;
create policy "subscriptions_org_members_select" on public.subscriptions
for select to authenticated
using (org_id = public.current_org_id());

drop policy if exists "payment_orders_org_members_select" on public.payment_orders;
create policy "payment_orders_org_members_select" on public.payment_orders
for select to authenticated
using (org_id = public.current_org_id());

drop policy if exists "payment_orders_org_members_insert" on public.payment_orders;
create policy "payment_orders_org_members_insert" on public.payment_orders
for insert to authenticated
with check (org_id = public.current_org_id());

drop policy if exists "plg_events_org_members_select" on public.plg_events;
create policy "plg_events_org_members_select" on public.plg_events
for select to authenticated
using (org_id = public.current_org_id());

insert into storage.buckets (id, name, public)
values ('payment-slips', 'payment-slips', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "payment_slips_upload" on storage.objects;
create policy "payment_slips_upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'payment-slips');

drop policy if exists "payment_slips_read" on storage.objects;
create policy "payment_slips_read" on storage.objects
for select to authenticated
using (bucket_id = 'payment-slips');
