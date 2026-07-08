-- Platform-wide configuration table
-- Used for: maintenance banner, feature flags, system announcements
create table if not exists public.platform_config (
  key        text        primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Readable by all authenticated users (maintenance banner needs to load at login)
alter table public.platform_config enable row level security;

create policy "platform_config_read_all"
  on public.platform_config for select
  using (true);

-- Seed default maintenance banner row (inactive)
insert into public.platform_config (key, value)
values (
  'maintenance_banner',
  '{"active": false, "severity": "info", "title": "", "message": "", "eta": ""}'::jsonb
)
on conflict (key) do nothing;
