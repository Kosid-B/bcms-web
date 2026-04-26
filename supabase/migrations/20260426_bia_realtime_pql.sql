create table if not exists public.bia_processes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  department text,
  owner text,
  description text,
  status text not null default 'draft',
  criticality integer not null default 3 check (criticality between 1 and 5),
  mac_pct integer not null default 40 check (mac_pct between 0 and 100),
  current_capacity_pct integer not null default 100 check (current_capacity_pct between 0 and 100),
  rto_minutes integer,
  rpo_minutes integer,
  mtpd_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

alter table public.bia_processes add column if not exists department text;
alter table public.bia_processes add column if not exists owner text;
alter table public.bia_processes add column if not exists description text;
alter table public.bia_processes add column if not exists status text not null default 'draft';
alter table public.bia_processes add column if not exists mac_pct integer not null default 40;
alter table public.bia_processes add column if not exists current_capacity_pct integer not null default 100;
alter table public.bia_processes add column if not exists rpo_minutes integer;
alter table public.bia_processes add column if not exists mtpd_minutes integer;
alter table public.bia_processes add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.bia_processes add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.bia_processes add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.bia_processes add column if not exists deleted_at timestamptz;

create table if not exists public.bc_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.bia_processes(id) on delete set null,
  title text not null,
  version text not null default '1.0',
  trigger_criteria text,
  status text not null default 'draft',
  tasks jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  deleted_at timestamptz
);

alter table public.bc_plans add column if not exists process_id uuid references public.bia_processes(id) on delete set null;
alter table public.bc_plans add column if not exists version text not null default '1.0';
alter table public.bc_plans add column if not exists trigger_criteria text;
alter table public.bc_plans add column if not exists status text not null default 'draft';
alter table public.bc_plans add column if not exists tasks jsonb not null default '[]'::jsonb;
alter table public.bc_plans add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.bc_plans add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.bc_plans add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.bc_plans add column if not exists approved_at timestamptz;
alter table public.bc_plans add column if not exists deleted_at timestamptz;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null default 'people',
  name text not null,
  description text,
  department text,
  unit text not null default 'หน่วย',
  qty_normal numeric,
  qty_minimum numeric,
  max_tolerable_loss_hrs integer,
  recovery_time_hrs integer,
  criticality integer not null default 2 check (criticality between 1 and 5),
  is_spof boolean not null default false,
  alternate_available boolean not null default false,
  alternate_description text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

alter table public.resources add column if not exists resource_type text not null default 'people';
alter table public.resources add column if not exists description text;
alter table public.resources add column if not exists department text;
alter table public.resources add column if not exists unit text not null default 'หน่วย';
alter table public.resources add column if not exists qty_normal numeric;
alter table public.resources add column if not exists qty_minimum numeric;
alter table public.resources add column if not exists max_tolerable_loss_hrs integer;
alter table public.resources add column if not exists recovery_time_hrs integer;
alter table public.resources add column if not exists criticality integer not null default 2;
alter table public.resources add column if not exists is_spof boolean not null default false;
alter table public.resources add column if not exists alternate_available boolean not null default false;
alter table public.resources add column if not exists alternate_description text;
alter table public.resources add column if not exists notes text;
alter table public.resources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.resources add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.resources add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.resources add column if not exists deleted_at timestamptz;

create table if not exists public.process_resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.bia_processes(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  dependency_level text not null default 'required',
  recovery_priority integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (process_id, resource_id)
);

alter table public.process_resources add column if not exists dependency_level text not null default 'required';
alter table public.process_resources add column if not exists recovery_priority integer;
alter table public.process_resources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.process_resources add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists bia_processes_org_id_idx on public.bia_processes(org_id);
create index if not exists bia_processes_org_status_idx on public.bia_processes(org_id, status);
create index if not exists bia_processes_capacity_idx on public.bia_processes(org_id, current_capacity_pct, mac_pct);
create index if not exists bc_plans_org_id_idx on public.bc_plans(org_id);
create index if not exists bc_plans_process_id_idx on public.bc_plans(process_id);
create index if not exists resources_org_id_idx on public.resources(org_id);
create index if not exists resources_org_type_idx on public.resources(org_id, resource_type);
create index if not exists resources_spof_idx on public.resources(org_id, is_spof, criticality);
create index if not exists process_resources_org_id_idx on public.process_resources(org_id);
create index if not exists process_resources_process_id_idx on public.process_resources(process_id);
create index if not exists process_resources_resource_id_idx on public.process_resources(resource_id);

drop trigger if exists trg_bia_processes_updated_at on public.bia_processes;
create trigger trg_bia_processes_updated_at
before update on public.bia_processes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_bc_plans_updated_at on public.bc_plans;
create trigger trg_bc_plans_updated_at
before update on public.bc_plans
for each row execute function public.touch_updated_at();

drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.touch_updated_at();

create or replace function public.check_mac_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mac_value integer;
begin
  mac_value := coalesce(
    case
      when new.metadata ? 'mac_pct'
        and (new.metadata ->> 'mac_pct') ~ '^[0-9]+$'
      then nullif((new.metadata ->> 'mac_pct')::integer, 0)
      else null
    end,
    new.mac_pct,
    40
  );

  if new.current_capacity_pct < mac_value
     and (old.current_capacity_pct is null or old.current_capacity_pct >= mac_value) then
    insert into public.plg_events (org_id, event_name, properties)
    values (
      new.org_id,
      'mac_trigger_activated',
      jsonb_build_object(
        'process_id', new.id,
        'process_name', new.name,
        'capacity', new.current_capacity_pct,
        'mac_pct', mac_value,
        'rto_minutes', new.rto_minutes,
        'criticality', new.criticality
      )
    );

    update public.bc_plans
    set
      status = case when status = 'approved' then status else 'triggered' end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_triggered_at', timezone('utc', now()),
        'triggered_by_process_id', new.id,
        'triggered_capacity_pct', new.current_capacity_pct,
        'triggered_mac_pct', mac_value
      )
    where org_id = new.org_id
      and (
        process_id = new.id
        or metadata ->> 'linked_process_id' = new.id::text
      )
      and deleted_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_bia_capacity_change on public.bia_processes;
create trigger on_bia_capacity_change
after update of current_capacity_pct on public.bia_processes
for each row execute function public.check_mac_trigger();

drop view if exists public.admin_hot_leads;
drop function if exists public.calculate_pql_score(uuid);

create or replace function public.calculate_pql_score(target_org_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  plan_name text;
  org_name text;
  recent_events integer;
  bia_count integer;
  bcp_count integer;
  mac_triggers integer;
  exports integer;
  pending_orders integer;
  confirmed_orders integer;
  score integer;
  level text;
  last_seen timestamptz;
begin
  select o.name into org_name
  from public.organizations o
  where o.id = target_org_id;

  select coalesce(s.plan, 'free') into plan_name
  from public.subscriptions s
  where s.org_id = target_org_id
  order by s.updated_at desc nulls last, s.created_at desc nulls last
  limit 1;

  plan_name := coalesce(plan_name, 'free');

  select count(*)::integer, max(created_at)
    into recent_events, last_seen
  from public.plg_events
  where org_id = target_org_id
    and created_at >= timezone('utc', now()) - interval '30 days';

  select count(*)::integer into bia_count
  from public.bia_processes
  where org_id = target_org_id
    and deleted_at is null;

  select count(*)::integer into bcp_count
  from public.bc_plans
  where org_id = target_org_id
    and deleted_at is null;

  select count(*)::integer into mac_triggers
  from public.plg_events
  where org_id = target_org_id
    and event_name = 'mac_trigger_activated'
    and created_at >= timezone('utc', now()) - interval '30 days';

  select count(*)::integer into exports
  from public.plg_events
  where org_id = target_org_id
    and event_name in ('report_exported', 'bia_pdf_generated')
    and created_at >= timezone('utc', now()) - interval '30 days';

  select count(*)::integer into pending_orders
  from public.payment_orders
  where org_id = target_org_id
    and status = 'pending';

  select count(*)::integer into confirmed_orders
  from public.payment_orders
  where org_id = target_org_id
    and status in ('confirmed', 'paid');

  score := least(100,
    (least(bia_count, 6) * 8)
    + (least(bcp_count, 4) * 10)
    + (least(mac_triggers, 3) * 12)
    + (least(exports, 3) * 6)
    + (least(recent_events, 20) * 1)
    + (pending_orders * 10)
    + (confirmed_orders * 15)
    + case plan_name
        when 'free' then 0
        when 'starter' then 8
        when 'professional' then 18
        when 'enterprise' then 25
        else 0
      end
  );

  level := case
    when score >= 85 then 'sales_ready'
    when score >= 60 then 'hot'
    when score >= 30 then 'warm'
    else 'cold'
  end;

  return jsonb_build_object(
    'org_id', target_org_id,
    'org_name', coalesce(org_name, 'Unknown organization'),
    'plan', plan_name,
    'score', score,
    'level', level,
    'last_seen', last_seen,
    'signals', jsonb_build_object(
      'bia_processes', bia_count,
      'bc_plans', bcp_count,
      'mac_triggers', mac_triggers,
      'exports', exports,
      'events_30d', recent_events,
      'pending_orders', pending_orders
    )
  );
end;
$$;

create or replace view public.admin_hot_leads as
select
  (lead.payload ->> 'org_id')::uuid as org_id,
  lead.payload ->> 'org_name' as org_name,
  lead.payload ->> 'plan' as plan,
  (lead.payload ->> 'score')::integer as score,
  lead.payload ->> 'level' as level,
  nullif(lead.payload ->> 'last_seen', '')::timestamptz as last_seen,
  lead.payload -> 'signals' as signals
from (
  select public.calculate_pql_score(o.id) as payload
  from public.organizations o
) lead
where (lead.payload ->> 'score')::integer >= 60
order by (lead.payload ->> 'score')::integer desc;

alter table public.bia_processes enable row level security;
alter table public.bc_plans enable row level security;
alter table public.resources enable row level security;
alter table public.process_resources enable row level security;

drop policy if exists "bia_processes_org_members_all" on public.bia_processes;
create policy "bia_processes_org_members_all" on public.bia_processes
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "bc_plans_org_members_all" on public.bc_plans;
create policy "bc_plans_org_members_all" on public.bc_plans
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "resources_org_members_all" on public.resources;
create policy "resources_org_members_all" on public.resources
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

drop policy if exists "process_resources_org_members_all" on public.process_resources;
create policy "process_resources_org_members_all" on public.process_resources
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

alter table public.bia_processes replica identity full;
alter table public.bc_plans replica identity full;
alter table public.resources replica identity full;
alter table public.plg_events replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'bia_processes'
    ) then
      alter publication supabase_realtime add table public.bia_processes;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'bc_plans'
    ) then
      alter publication supabase_realtime add table public.bc_plans;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'plg_events'
    ) then
      alter publication supabase_realtime add table public.plg_events;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'resources'
    ) then
      alter publication supabase_realtime add table public.resources;
    end if;
  end if;
end $$;
