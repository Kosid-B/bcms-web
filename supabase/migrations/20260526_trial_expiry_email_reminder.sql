-- 3-day trial expiry email reminder support

create table if not exists public.trial_expiry_email_log (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  trial_end_date date not null,
  recipient_email text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  provider text not null default 'resend',
  unique (org_id, trial_end_date, recipient_email)
);

create index if not exists trial_expiry_email_log_org_idx
  on public.trial_expiry_email_log(org_id, trial_end_date);

alter table public.trial_expiry_email_log enable row level security;

drop policy if exists "trial_expiry_email_log_super_admin_read" on public.trial_expiry_email_log;
create policy "trial_expiry_email_log_super_admin_read"
on public.trial_expiry_email_log
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'owner')
  )
);

create or replace function public.get_trial_expiry_candidates(p_days_before integer default 3)
returns table (
  org_id uuid,
  org_name text,
  trial_ends_at timestamptz,
  recipient_email text,
  days_left integer
)
language sql
security definer
set search_path = public, auth
as $$
  with due as (
    select
      s.org_id,
      o.name as org_name,
      s.trial_ends_at,
      u.email as recipient_email,
      ((date(s.trial_ends_at) - date(timezone('utc', now()))))::int as days_left
    from public.subscriptions s
    join public.organizations o on o.id = s.org_id
    join public.profiles p on p.org_id = s.org_id and p.role = 'owner'
    join auth.users u on u.id = p.id
    where s.plan = 'free'
      and s.status = 'trialing'
      and s.trial_ends_at is not null
      and date(s.trial_ends_at) = date(timezone('utc', now()) + make_interval(days => p_days_before))
      and s.org_id <> '00000000-0000-0000-0000-000000000000'::uuid
  )
  select d.*
  from due d
  where not exists (
    select 1
    from public.trial_expiry_email_log l
    where l.org_id = d.org_id
      and l.trial_end_date = date(d.trial_ends_at)
      and lower(l.recipient_email) = lower(d.recipient_email)
  );
$$;

create or replace function public.mark_trial_expiry_email_sent(
  p_org_id uuid,
  p_trial_ends_at timestamptz,
  p_recipient_email text,
  p_provider text default 'resend'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trial_expiry_email_log (org_id, trial_end_date, recipient_email, provider)
  values (p_org_id, date(p_trial_ends_at), lower(trim(p_recipient_email)), p_provider)
  on conflict (org_id, trial_end_date, recipient_email) do nothing;
end;
$$;
