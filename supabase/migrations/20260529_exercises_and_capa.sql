-- Exercises (drill log) table — ISO 22301 §8.5
create table if not exists public.exercises (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  title          text not null,
  date           text not null default '',
  type           text not null default 'tabletop',  -- tabletop | drill | fullscale | walkthrough
  participants   text not null default '',
  objectives     text not null default '',
  findings       text not null default '',
  lessons        text not null default '',
  status         text not null default 'completed',
  evidence       jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

create index if not exists exercises_org_idx on public.exercises(org_id);

alter table public.exercises enable row level security;

drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises
  for select to authenticated using (org_id = public.current_org_id());

drop policy if exists "exercises_insert" on public.exercises;
create policy "exercises_insert" on public.exercises
  for insert to authenticated with check (org_id = public.current_org_id());

drop policy if exists "exercises_update" on public.exercises;
create policy "exercises_update" on public.exercises
  for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "exercises_delete" on public.exercises;
create policy "exercises_delete" on public.exercises
  for delete to authenticated using (org_id = public.current_org_id());

-- CAPA items table — ISO 22301 §10.1 Corrective Action
create table if not exists public.capa_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  finding     text not null,
  action      text not null default '',
  owner       text not null default '',
  due         text not null default '',
  status      text not null default 'open',   -- open | in_progress | done
  exercise_id uuid references public.exercises(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists capa_items_org_idx on public.capa_items(org_id);

alter table public.capa_items enable row level security;

drop policy if exists "capa_select" on public.capa_items;
create policy "capa_select" on public.capa_items
  for select to authenticated using (org_id = public.current_org_id());

drop policy if exists "capa_insert" on public.capa_items;
create policy "capa_insert" on public.capa_items
  for insert to authenticated with check (org_id = public.current_org_id());

drop policy if exists "capa_update" on public.capa_items;
create policy "capa_update" on public.capa_items
  for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists "capa_delete" on public.capa_items;
create policy "capa_delete" on public.capa_items
  for delete to authenticated using (org_id = public.current_org_id());
