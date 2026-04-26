drop view if exists public.admin_hot_leads;

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
  where o.id <> '00000000-0000-0000-0000-000000000000'::uuid
    and coalesce(o.name, '') <> 'PLATFORM_CONFIG'
) lead
where (lead.payload ->> 'score')::integer >= 60
   or (lead.payload -> 'signals' ->> 'win_back')::integer = 1
order by
  ((lead.payload -> 'signals' ->> 'win_back')::integer) desc,
  (lead.payload ->> 'score')::integer desc;
