-- ============================================================
-- PDPA: Right to Erasure — Account Self-Deletion
-- ============================================================

-- 1. Add deleted_at to organizations (soft-delete marker)
alter table public.organizations
  add column if not exists deleted_at timestamptz;

-- Partial index so normal queries exclude deleted orgs
create index if not exists idx_organizations_active
  on public.organizations (id) where deleted_at is null;

-- 2. RPC: user-initiated account deletion (PDPA Art. 33 — right to erasure)
--    Only the org 'owner' role can trigger this.
--    Soft-deletes org + cancels subscription + anonymises profile PII.
--    Hard-delete of auth.users requires service-role; a nightly cron handles that.
create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into v_org_id
  from public.profiles
  where id = v_uid;

  if v_org_id is null then
    raise exception 'Organization not found';
  end if;

  -- Only owners may delete the org
  if not exists (
    select 1 from public.profiles
    where id = v_uid and org_id = v_org_id and role = 'owner'
  ) then
    raise exception 'Only the organization owner can delete the account';
  end if;

  -- Soft-delete org
  update public.organizations
  set deleted_at = now(), status = 'deleted', updated_at = now()
  where id = v_org_id;

  -- Cancel subscription
  update public.subscriptions
  set status = 'cancelled', updated_at = now()
  where org_id = v_org_id;

  -- Anonymise profile PII (PDPA: data minimisation after erasure request)
  update public.profiles
  set full_name    = 'Deleted User',
      display_name = 'Deleted User',
      phone        = null,
      updated_at   = now()
  where id = v_uid;

  return jsonb_build_object('success', true, 'deleted_at', now()::text);
end;
$$;

-- 3. RLS: allow the function to be called by any authenticated user
--    (security definer + auth.uid() check inside the function is the gate)
revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
