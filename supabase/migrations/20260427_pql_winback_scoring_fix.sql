-- Re-apply win-back scoring after the date-only BIA migration so this version wins.
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
  latest_subscription_status text;
  recent_events integer;
  bia_count integer;
  bcp_count integer;
  mac_triggers integer;
  exports integer;
  pending_orders integer;
  confirmed_orders integer;
  paid_subscriptions integer;
  paid_before boolean;
  win_back boolean;
  score integer;
  level text;
  last_seen timestamptz;
begin
  select o.name into org_name
  from public.organizations o
  where o.id = target_org_id;

  select
    coalesce(s.plan, 'free'),
    coalesce(s.status, 'inactive')
    into plan_name, latest_subscription_status
  from public.subscriptions s
  where s.org_id = target_org_id
  order by s.updated_at desc nulls last, s.created_at desc nulls last
  limit 1;

  plan_name := coalesce(plan_name, 'free');
  latest_subscription_status := coalesce(latest_subscription_status, 'inactive');

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

  select count(*)::integer into paid_subscriptions
  from public.subscriptions
  where org_id = target_org_id
    and coalesce(plan, 'free') <> 'free'
    and coalesce(status, '') in ('active', 'trialing', 'past_due', 'canceled', 'expired', 'inactive');

  paid_before := paid_subscriptions > 0 or confirmed_orders > 0;
  win_back := paid_before
    and not (
      latest_subscription_status in ('active', 'trialing', 'past_due')
      and plan_name <> 'free'
    );

  score := least(100,
    (least(bia_count, 6) * 8)
    + (least(bcp_count, 4) * 10)
    + (least(mac_triggers, 3) * 12)
    + (least(exports, 3) * 6)
    + (least(recent_events, 20) * 1)
    + (pending_orders * 10)
    + (confirmed_orders * 15)
    + case when paid_before then 10 else 0 end
    + case when win_back then 20 else 0 end
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
    'subscription_status', latest_subscription_status,
    'segment', case when win_back then 'win_back' else 'standard' end,
    'signals', jsonb_build_object(
      'bia_processes', bia_count,
      'bc_plans', bcp_count,
      'mac_triggers', mac_triggers,
      'exports', exports,
      'events_30d', recent_events,
      'pending_orders', pending_orders,
      'confirmed_orders', confirmed_orders,
      'paid_before', case when paid_before then 1 else 0 end,
      'win_back', case when win_back then 1 else 0 end
    )
  );
end;
$$;

create or replace view public.admin_hot_leads as
select
  (lead.payload ->> 'org_id')::uuid as org_id,
  lead.payload ->> 'org_name' as org_name,
  lead.payload ->> 'plan' as plan,
  lead.payload ->> 'subscription_status' as subscription_status,
  lead.payload ->> 'segment' as segment,
  (lead.payload ->> 'score')::integer as score,
  lead.payload ->> 'level' as level,
  nullif(lead.payload ->> 'last_seen', '')::timestamptz as last_seen,
  lead.payload -> 'signals' as signals
from (
  select public.calculate_pql_score(o.id) as payload
  from public.organizations o
) lead
where (lead.payload ->> 'score')::integer >= 60
   or (lead.payload -> 'signals' ->> 'win_back')::integer = 1
order by
  ((lead.payload -> 'signals' ->> 'win_back')::integer) desc,
  (lead.payload ->> 'score')::integer desc;
