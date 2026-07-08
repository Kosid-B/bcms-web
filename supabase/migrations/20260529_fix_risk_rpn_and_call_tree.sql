-- Fix 1: Add missing RPN columns to risk_items (UI uses S×L×D system)
alter table public.risk_items
  add column if not exists severity      smallint not null default 2 check (severity      between 1 and 3),
  add column if not exists detectability smallint not null default 2 check (detectability between 1 and 3),
  add column if not exists rpn           integer  not null default 4;

update public.risk_items
set
  severity      = least(3, greatest(1, coalesce(impact, 2))),
  detectability = 2,
  rpn           = least(3, greatest(1, coalesce(impact, 2))) * coalesce(likelihood, 2) * 2
where severity = 2 and detectability = 2 and rpn = 4;

-- Fix 2: ts alias column on bcm_monitor_events
alter table public.bcm_monitor_events
  add column if not exists ts timestamptz;
update public.bcm_monitor_events set ts = created_at where ts is null;

-- Fix 3: call_tree_contacts
create table if not exists public.call_tree_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  role        text not null default '',
  phone       text not null default '',
  email       text not null default '',
  line_id     text not null default '',
  tier        smallint not null default 2 check (tier between 1 and 3),
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists call_tree_contacts_org_idx on public.call_tree_contacts(org_id);

alter table public.call_tree_contacts enable row level security;

drop policy if exists "ctc_org_select" on public.call_tree_contacts;
create policy "ctc_org_select" on public.call_tree_contacts
  for select to authenticated using (org_id = public.current_org_id());

drop policy if exists "ctc_org_insert" on public.call_tree_contacts;
create policy "ctc_org_insert" on public.call_tree_contacts
  for insert to authenticated with check (org_id = public.current_org_id());

drop policy if exists "ctc_org_update" on public.call_tree_contacts;
create policy "ctc_org_update" on public.call_tree_contacts
  for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "ctc_org_delete" on public.call_tree_contacts;
create policy "ctc_org_delete" on public.call_tree_contacts
  for delete to authenticated using (org_id = public.current_org_id());
