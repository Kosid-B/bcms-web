create or replace function public.generate_bcp_automate(
  p_process_id uuid,
  p_strategy_id uuid default null,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_process record;
  v_strategy record;
  v_plan_id uuid;
  v_title text;
  v_tasks jsonb := '[]'::jsonb;
begin
  select *
  into v_process
  from public.bia_processes
  where id = p_process_id
    and deleted_at is null
  limit 1;

  if v_process.id is null then
    raise exception 'BIA process not found';
  end if;

  v_org_id := v_process.org_id;
  if v_org_id <> public.current_org_id() then
    raise exception 'Access denied';
  end if;

  if p_strategy_id is not null then
    select *
    into v_strategy
    from public.continuity_strategies
    where id = p_strategy_id
      and org_id = v_org_id
      and deleted_at is null
    limit 1;
  end if;

  v_title := coalesce(nullif(trim(p_title), ''), 'BCP - ' || v_process.name);

  if p_strategy_id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source', 'continuity_strategy',
          'strategy_id', p_strategy_id,
          'step_no', s.step_no,
          'phase', s.phase,
          'title', s.title,
          'instruction', s.instruction,
          'owner', s.responsible_role,
          'target_minutes', s.target_minutes
        )
        order by s.step_no
      ),
      '[]'::jsonb
    )
    into v_tasks
    from public.continuity_procedure_steps s
    where s.org_id = v_org_id
      and s.strategy_id = p_strategy_id;
  end if;

  insert into public.bc_plans (
    org_id,
    process_id,
    title,
    version,
    trigger_criteria,
    status,
    tasks,
    department,
    metadata
  ) values (
    v_org_id,
    v_process.id,
    v_title,
    '1.0',
    'Trigger: capacity < ' || coalesce(v_process.mac_pct, 40)::text || '%, Start RTO clock immediately',
    'draft',
    v_tasks,
    v_process.department,
    jsonb_build_object(
      'automated', true,
      'automated_from', 'generate_bcp_automate',
      'strategy_id', p_strategy_id,
      'strategy_name', v_strategy.strategy_name,
      'target_rto_minutes', coalesce(v_strategy.target_rto_minutes, v_process.rto_minutes),
      'target_mac_pct', coalesce(v_strategy.target_mac_pct, v_process.mac_pct),
      'iso_reference', coalesce(v_strategy.iso_reference, 'ISO 22313 / ISO 22317')
    )
  )
  returning id into v_plan_id;

  if p_strategy_id is not null then
    update public.continuity_strategies
    set bc_plan_id = v_plan_id
    where id = p_strategy_id
      and org_id = v_org_id;
  end if;

  return v_plan_id;
end;
$$;

create or replace function public.evaluate_bcp_readiness(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_plan record;
  v_has_strategy boolean;
  v_tasks_count integer := 0;
  v_has_trigger boolean;
  v_ready boolean;
begin
  select *
  into v_plan
  from public.bc_plans
  where id = p_plan_id
    and org_id = public.current_org_id()
    and deleted_at is null
  limit 1;

  if v_plan.id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'plan_not_found'
    );
  end if;

  v_tasks_count := coalesce(jsonb_array_length(coalesce(v_plan.tasks, '[]'::jsonb)), 0);
  v_has_trigger := coalesce(length(trim(coalesce(v_plan.trigger_criteria, ''))) > 0, false);

  select exists (
    select 1
    from public.continuity_strategies s
    where s.org_id = v_plan.org_id
      and s.bc_plan_id = v_plan.id
      and s.deleted_at is null
  ) into v_has_strategy;

  v_ready := v_has_trigger and v_tasks_count >= 3 and v_has_strategy and v_plan.process_id is not null;

  return jsonb_build_object(
    'ok', true,
    'ready', v_ready,
    'checks', jsonb_build_object(
      'has_process_link', v_plan.process_id is not null,
      'has_trigger', v_has_trigger,
      'has_strategy_link', v_has_strategy,
      'task_count', v_tasks_count,
      'minimum_tasks_pass', v_tasks_count >= 3
    )
  );
end;
$$;
