create table if not exists public.continuity_strategies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.bia_processes(id) on delete set null,
  bc_plan_id uuid references public.bc_plans(id) on delete set null,
  department text,
  strategy_code text not null,
  strategy_name text not null,
  strategy_category text not null default 'resource',
  objective text,
  rationale text,
  iso_reference text,
  target_rto_minutes integer,
  target_mac_pct integer check (target_mac_pct between 0 and 100),
  owner text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.continuity_procedure_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  strategy_id uuid not null references public.continuity_strategies(id) on delete cascade,
  step_no integer not null,
  phase text not null default 'respond',
  title text not null,
  instruction text,
  responsible_role text,
  target_minutes integer,
  mandatory boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (strategy_id, step_no)
);

create index if not exists continuity_strategies_org_id_idx on public.continuity_strategies(org_id);
create index if not exists continuity_strategies_process_id_idx on public.continuity_strategies(process_id);
create index if not exists continuity_strategies_plan_id_idx on public.continuity_strategies(bc_plan_id);
create index if not exists continuity_strategies_department_idx on public.continuity_strategies(org_id, department);
create index if not exists continuity_procedure_steps_org_id_idx on public.continuity_procedure_steps(org_id);
create index if not exists continuity_procedure_steps_strategy_idx on public.continuity_procedure_steps(strategy_id, step_no);

drop trigger if exists trg_continuity_strategies_updated_at on public.continuity_strategies;
create trigger trg_continuity_strategies_updated_at
before update on public.continuity_strategies
for each row execute function public.touch_updated_at();

drop trigger if exists trg_continuity_procedure_steps_updated_at on public.continuity_procedure_steps;
create trigger trg_continuity_procedure_steps_updated_at
before update on public.continuity_procedure_steps
for each row execute function public.touch_updated_at();

alter table public.continuity_strategies enable row level security;
alter table public.continuity_procedure_steps enable row level security;

drop policy if exists "continuity_strategies_org_members_all" on public.continuity_strategies;
create policy "continuity_strategies_org_members_all" on public.continuity_strategies
for all to authenticated
using (
  org_id = public.current_org_id()
  and (
    public.has_department_access(org_id, department)
    or (
      process_id is not null
      and exists (
        select 1
        from public.bia_processes p
        where p.id = continuity_strategies.process_id
          and p.org_id = continuity_strategies.org_id
          and public.has_department_access(p.org_id, p.department)
      )
    )
  )
)
with check (
  org_id = public.current_org_id()
  and (
    public.has_department_access(org_id, department)
    or (
      process_id is not null
      and exists (
        select 1
        from public.bia_processes p
        where p.id = continuity_strategies.process_id
          and p.org_id = continuity_strategies.org_id
          and public.has_department_access(p.org_id, p.department)
      )
    )
  )
);

drop policy if exists "continuity_procedure_steps_org_members_all" on public.continuity_procedure_steps;
create policy "continuity_procedure_steps_org_members_all" on public.continuity_procedure_steps
for all to authenticated
using (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.continuity_strategies s
    where s.id = continuity_procedure_steps.strategy_id
      and s.org_id = continuity_procedure_steps.org_id
      and (
        public.has_department_access(s.org_id, s.department)
        or (
          s.process_id is not null
          and exists (
            select 1
            from public.bia_processes p
            where p.id = s.process_id
              and p.org_id = s.org_id
              and public.has_department_access(p.org_id, p.department)
          )
        )
      )
  )
)
with check (
  org_id = public.current_org_id()
  and exists (
    select 1
    from public.continuity_strategies s
    where s.id = continuity_procedure_steps.strategy_id
      and s.org_id = continuity_procedure_steps.org_id
      and (
        public.has_department_access(s.org_id, s.department)
        or (
          s.process_id is not null
          and exists (
            select 1
            from public.bia_processes p
            where p.id = s.process_id
              and p.org_id = s.org_id
              and public.has_department_access(p.org_id, p.department)
          )
        )
      )
  )
);
