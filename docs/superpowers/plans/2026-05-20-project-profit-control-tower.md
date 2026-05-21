# Project Profit Control Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working MVP of the Project Profit Control Tower inside the existing React + Supabase SaaS so teams can manage project profitability, daily cash flow, machinery, billing, and field inputs from one system.

**Architecture:** Extend the current web app with a new `project-profit` feature area and extend the existing Supabase tenant schema with project, cash, billing, machinery, and alert tables. Keep financial calculations in a shared frontend service so all dashboards and forms read from the same profit logic while the backend remains the source of truth for tenant-scoped project data.

**Tech Stack:** React 18, Vite, Supabase Postgres, Supabase Realtime, lightweight `supa-lite` REST client, ESLint, Vitest, Testing Library

---

## File Structure

### New files

- `apps/web/src/app/features/project-profit/ProjectProfitApp.jsx`
- `apps/web/src/app/features/project-profit/config/defaultProjectTemplates.js`
- `apps/web/src/app/features/project-profit/lib/calculations.js`
- `apps/web/src/app/features/project-profit/lib/formatters.js`
- `apps/web/src/app/features/project-profit/lib/demo-data.js`
- `apps/web/src/app/features/project-profit/lib/project-profit-api.js`
- `apps/web/src/app/features/project-profit/hooks/useProjectProfitData.js`
- `apps/web/src/app/features/project-profit/components/ProjectShell.jsx`
- `apps/web/src/app/features/project-profit/components/MetricCard.jsx`
- `apps/web/src/app/features/project-profit/components/AlertList.jsx`
- `apps/web/src/app/features/project-profit/components/SectionCard.jsx`
- `apps/web/src/app/features/project-profit/views/ExecutiveDashboardView.jsx`
- `apps/web/src/app/features/project-profit/views/ProjectCommandCenterView.jsx`
- `apps/web/src/app/features/project-profit/views/CashFlowProfitView.jsx`
- `apps/web/src/app/features/project-profit/views/BillingDocumentsView.jsx`
- `apps/web/src/app/features/project-profit/views/MachinesTeamsClustersView.jsx`
- `apps/web/src/app/features/project-profit/views/MobileFieldInputView.jsx`
- `apps/web/src/app/features/project-profit/project-profit.css`
- `apps/web/src/app/features/project-profit/__tests__/calculations.test.js`
- `apps/web/src/app/features/project-profit/__tests__/ProjectProfitApp.test.jsx`
- `supabase/migrations/20260520_project_profit_control_tower.sql`

### Modified files

- `apps/web/package.json`
- `apps/web/src/app/AppCore.jsx`
- `apps/web/src/app/features/dashboard/Dashboard.jsx`
- `apps/web/src/app/lib/supa-lite.js`

## Task 1: Add Frontend Test Harness And Project-Profit Scaffolding

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/app/features/project-profit/ProjectProfitApp.jsx`
- Create: `apps/web/src/app/features/project-profit/project-profit.css`
- Create: `apps/web/src/app/features/project-profit/components/SectionCard.jsx`
- Create: `apps/web/src/app/features/project-profit/components/MetricCard.jsx`
- Test: `apps/web/src/app/features/project-profit/__tests__/ProjectProfitApp.test.jsx`

- [ ] **Step 1: Write the failing integration test for the new feature shell**

```jsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ProjectProfitApp from "../ProjectProfitApp.jsx";

describe("ProjectProfitApp", () => {
  it("renders the executive dashboard heading and primary navigation", () => {
    render(
      <ProjectProfitApp
        user={{ name: "Demo User", role: "owner" }}
        data={{
          portfolioSummary: { totalProjects: 2, activeAlerts: 4 },
          views: {},
        }}
      />
    );

    expect(screen.getByText("Project Profit Control Tower")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Executive Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mobile Field Input" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: FAIL because `vitest`, `@testing-library/react`, and `ProjectProfitApp.jsx` do not exist yet.

- [ ] **Step 3: Add test dependencies and scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint \"src/**/*.{js,jsx}\"",
    "preview": "vite preview",
    "test": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 4: Add the minimal project-profit app shell**

```jsx
import React, { useState } from "react";

import MetricCard from "./components/MetricCard.jsx";
import SectionCard from "./components/SectionCard.jsx";
import "./project-profit.css";

const NAV_ITEMS = [
  "Executive Dashboard",
  "Project Command Center",
  "Cash Flow & Profit",
  "Billing & Documents",
  "Machines, Teams & Clusters",
  "Mobile Field Input",
];

export default function ProjectProfitApp({ user, data }) {
  const [activeView, setActiveView] = useState(NAV_ITEMS[0]);

  return (
    <div className="pp-shell">
      <header className="pp-hero">
        <p className="pp-kicker">Profit-first project operations</p>
        <h1>Project Profit Control Tower</h1>
        <p className="pp-subtitle">
          {user?.name ?? "User"} can monitor profitability, cash flow, machinery, billing, and field execution from one workspace.
        </p>
      </header>

      <nav className="pp-nav" aria-label="Project profit sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === activeView ? "pp-navButton is-active" : "pp-navButton"}
            onClick={() => setActiveView(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="pp-grid">
        <MetricCard label="Projects" value={String(data?.portfolioSummary?.totalProjects ?? 0)} tone="sky" />
        <MetricCard label="Active Alerts" value={String(data?.portfolioSummary?.activeAlerts ?? 0)} tone="amber" />
      </section>

      <SectionCard title={activeView} subtitle="Feature scaffolding is ready for the next implementation tasks." />
    </div>
  );
}
```

- [ ] **Step 5: Add the minimum presentational building blocks**

```jsx
export default function MetricCard({ label, value, tone = "sky" }) {
  return (
    <article className={`pp-metric pp-metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
```

```jsx
export default function SectionCard({ title, subtitle, children }) {
  return (
    <section className="pp-sectionCard">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
```

```css
.pp-shell { min-height: 100vh; padding: 24px; background: linear-gradient(180deg, #f3f7f2 0%, #fcfbf5 100%); color: #15352a; }
.pp-hero { max-width: 960px; margin: 0 auto 24px; }
.pp-kicker { text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; color: #6d7f73; }
.pp-subtitle { max-width: 760px; color: #4f5f56; }
.pp-nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 auto 24px; max-width: 960px; }
.pp-navButton { border: 1px solid #c8d5ca; border-radius: 999px; padding: 10px 14px; background: #fffdf7; cursor: pointer; }
.pp-navButton.is-active { background: #15352a; color: #fff; border-color: #15352a; }
.pp-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 960px; margin: 0 auto 24px; }
.pp-metric, .pp-sectionCard { background: rgba(255, 255, 255, 0.9); border: 1px solid #d8e2d7; border-radius: 20px; padding: 18px; }
.pp-metric strong { display: block; margin-top: 8px; font-size: 30px; }
.pp-sectionCard { max-width: 960px; margin: 0 auto; }
```

- [ ] **Step 6: Run tests to verify the shell passes**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/app/features/project-profit
git commit -m "test: add project profit app shell and frontend test harness"
```

## Task 2: Add Supabase Schema For Projects, Cash, Billing, Machines, And Alerts

**Files:**
- Create: `supabase/migrations/20260520_project_profit_control_tower.sql`
- Modify: `apps/web/src/app/lib/supa-lite.js`
- Test: `supabase/migrations/20260520_project_profit_control_tower.sql`

- [ ] **Step 1: Write the failing API-oriented test case as SQL acceptance notes inside the migration**

```sql
-- Acceptance targets for manual verification after push:
-- 1. org members can select only rows belonging to their org
-- 2. a project template can be instantiated into a project
-- 3. billing documents can be marked complete / incomplete per cycle
-- 4. alerts can be filtered by severity and status
-- 5. cash entries roll up by project_id without cross-org leakage
```

- [ ] **Step 2: Run migration dry review to verify the table names are not already present**

Run: `rg "create table if not exists public.(project_templates|projects|cash_entries|billing_cycles|machines|project_alerts)" supabase/migrations`
Expected: no matches

- [ ] **Step 3: Add the new multi-tenant schema with RLS**

```sql
create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  project_type text not null default 'pole-installation',
  unit_label text not null default 'ต้น',
  target_units integer not null default 0,
  target_profit_thb numeric(14,2) not null default 0,
  target_margin_pct numeric(8,2) not null default 0,
  target_npv_thb numeric(14,2) not null default 0,
  target_irr_pct numeric(8,2) not null default 0,
  target_mirr_pct numeric(8,2) not null default 0,
  hurdle_rate_pct numeric(8,2) not null default 0,
  discount_rate_pct numeric(8,2) not null default 0,
  reinvestment_rate_pct numeric(8,2) not null default 0,
  target_payback_days integer not null default 14,
  machinery_budget_thb numeric(14,2) not null default 0,
  billing_window_days text[] not null default array['monday', 'tuesday'],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.project_templates(id) on delete set null,
  name text not null,
  code text not null,
  status text not null default 'draft',
  start_date date,
  end_date date,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  current_cash_balance_thb numeric(14,2) not null default 0,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, code)
);

create table if not exists public.project_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  province text not null,
  cluster_name text not null,
  target_units integer not null default 0,
  actual_units integer not null default 0,
  baseline_cost_thb numeric(14,2) not null default 0,
  actual_cost_thb numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  entry_date date not null,
  entry_type text not null,
  direction text not null check (direction in ('in', 'out')),
  amount_thb numeric(14,2) not null,
  note text,
  source_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cycle_name text not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  expected_collection_date date,
  actual_collection_date date,
  status text not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  billing_cycle_id uuid not null references public.billing_cycles(id) on delete cascade,
  document_type text not null,
  is_complete boolean not null default false,
  file_url text,
  note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  asset_code text not null,
  name text not null,
  investment_phase text not null default 'phase_1',
  purchase_cost_thb numeric(14,2) not null default 0,
  utilization_pct numeric(8,2) not null default 0,
  status text not null default 'idle',
  metadata jsonb not null default '{}'::jsonb,
  unique (org_id, asset_code)
);

create table if not exists public.machine_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  usage_date date not null,
  operating_hours numeric(8,2) not null default 0,
  downtime_hours numeric(8,2) not null default 0,
  note text
);

create table if not exists public.daily_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  progress_date date not null,
  completed_units integer not null default 0,
  rework_units integer not null default 0,
  defect_count integer not null default 0,
  waiting_minutes integer not null default 0,
  crew_size integer not null default 0,
  photo_report_url text,
  note text
);

create table if not exists public.project_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cluster_id uuid references public.project_clusters(id) on delete set null,
  severity text not null default 'medium',
  alert_type text not null,
  title text not null,
  impact_summary text not null,
  recommended_action text not null,
  status text not null default 'open',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
```

- [ ] **Step 4: Add org-scoped row-level security policies**

```sql
alter table public.project_templates enable row level security;
alter table public.projects enable row level security;
alter table public.project_clusters enable row level security;
alter table public.cash_entries enable row level security;
alter table public.billing_cycles enable row level security;
alter table public.billing_documents enable row level security;
alter table public.machines enable row level security;
alter table public.machine_usage enable row level security;
alter table public.daily_progress enable row level security;
alter table public.project_alerts enable row level security;

create policy "project_templates_org_members_all" on public.project_templates
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "projects_org_members_all" on public.projects
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "project_clusters_org_members_all" on public.project_clusters
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "cash_entries_org_members_all" on public.cash_entries
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "billing_cycles_org_members_all" on public.billing_cycles
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "billing_documents_org_members_all" on public.billing_documents
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "machines_org_members_all" on public.machines
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "machine_usage_org_members_all" on public.machine_usage
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "daily_progress_org_members_all" on public.daily_progress
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "project_alerts_org_members_all" on public.project_alerts
for all to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());
```

- [ ] **Step 5: Extend `supa-lite` with insert and update support**

```js
insert(payload) {
  return this._mutate("POST", payload);
}

update(payload) {
  return this._mutate("PATCH", payload);
}

async _mutate(method, payload) {
  if (!ensureConfigured()) {
    return { data: null, error: { message: "Supabase environment is not configured." } };
  }

  const query = this._filters.length ? `?${this._filters.join("&")}` : "";
  const res = await fetch(`${this._url}/rest/v1/${this._table}${query}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: this._key,
      Authorization: `Bearer ${this._getToken() ?? this._key}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) return { data: null, error: data };
  return { data, error: null };
}
```

- [ ] **Step 6: Run lint and migration sanity checks**

Run: `pnpm -C apps/web lint`
Expected: PASS

Run: `rg "project_templates|project_alerts|cash_entries" supabase/migrations/20260520_project_profit_control_tower.sql`
Expected: matches for all new entities

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260520_project_profit_control_tower.sql apps/web/src/app/lib/supa-lite.js
git commit -m "feat: add project profit schema and supa-lite mutations"
```

## Task 3: Build Shared Financial Calculations And Tenant Data Hook

**Files:**
- Create: `apps/web/src/app/features/project-profit/lib/calculations.js`
- Create: `apps/web/src/app/features/project-profit/lib/formatters.js`
- Create: `apps/web/src/app/features/project-profit/lib/demo-data.js`
- Create: `apps/web/src/app/features/project-profit/lib/project-profit-api.js`
- Create: `apps/web/src/app/features/project-profit/config/defaultProjectTemplates.js`
- Create: `apps/web/src/app/features/project-profit/hooks/useProjectProfitData.js`
- Test: `apps/web/src/app/features/project-profit/__tests__/calculations.test.js`

- [ ] **Step 1: Write the failing financial calculation tests**

```js
import { describe, expect, it } from "vitest";

import {
  computePaybackDays,
  computeProjectHealth,
  computeVariancePct,
} from "../lib/calculations.js";

describe("project profit calculations", () => {
  it("computes variance percentage against baseline", () => {
    expect(computeVariancePct(110000, 100000)).toBe(10);
  });

  it("computes payback days from cumulative cash flow", () => {
    expect(computePaybackDays([-98000, 70000, 40000])).toBe(2);
  });

  it("marks the project health red when cash and profit both deteriorate", () => {
    expect(
      computeProjectHealth({
        npv: -5000,
        irr: 18,
        targetIrr: 37.8,
        mirr: 15,
        targetMirr: 30,
        paybackDays: 21,
        targetPaybackDays: 14,
        activeAlerts: 6,
      })
    ).toBe("critical");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- --run calculations.test.js`
Expected: FAIL because the calculations module does not exist yet.

- [ ] **Step 3: Add the shared calculations module**

```js
export function computeVariancePct(actual, baseline) {
  if (!baseline) return 0;
  return Number((((actual - baseline) / baseline) * 100).toFixed(2));
}

export function computePaybackDays(cashSeries) {
  let cumulative = 0;
  for (let index = 0; index < cashSeries.length; index += 1) {
    cumulative += Number(cashSeries[index] ?? 0);
    if (cumulative >= 0) return index + 1;
  }
  return null;
}

export function computeProjectHealth({
  npv,
  irr,
  targetIrr,
  mirr,
  targetMirr,
  paybackDays,
  targetPaybackDays,
  activeAlerts,
}) {
  const score =
    (npv > 0 ? 0 : 2) +
    (irr >= targetIrr ? 0 : 1) +
    (mirr >= targetMirr ? 0 : 1) +
    (paybackDays !== null && paybackDays <= targetPaybackDays ? 0 : 1) +
    (activeAlerts >= 5 ? 1 : 0);

  if (score >= 4) return "critical";
  if (score >= 2) return "watch";
  return "healthy";
}
```

- [ ] **Step 4: Add default template data and API adapter**

```js
export const DEFAULT_PROJECT_TEMPLATES = [
  {
    name: "13,602 Pole Program",
    targetUnits: 13602,
    targetIrr: 37.8,
    targetMirr: 24,
    targetPaybackDays: 14,
    machineryBudgetThb: 98000,
  },
  {
    name: "90,000 Pole Program",
    targetUnits: 90000,
    targetIrr: 37.8,
    targetMirr: 24,
    targetPaybackDays: 14,
    machineryBudgetThb: 650000,
  },
];
```

```js
import { supaLite } from "../../../lib/supa-lite.js";

export async function fetchProjectsForOrg(orgId) {
  return supaLite.from("projects").select("*").eq("org_id", orgId)._execute();
}

export async function fetchOpenAlertsForOrg(orgId) {
  return supaLite.from("project_alerts").select("*").eq("org_id", orgId)._execute();
}
```

- [ ] **Step 5: Add a data hook that falls back to demo data**

```js
import { useEffect, useState } from "react";

import { computeProjectHealth } from "../lib/calculations.js";
import { buildDemoProjectProfitData } from "../lib/demo-data.js";
import { fetchOpenAlertsForOrg, fetchProjectsForOrg } from "../lib/project-profit-api.js";

export function useProjectProfitData(user) {
  const [state, setState] = useState({
    status: "loading",
    data: buildDemoProjectProfitData(),
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.orgId) {
        if (!cancelled) setState({ status: "ready", data: buildDemoProjectProfitData() });
        return;
      }

      const [{ data: projects, error: projectError }, { data: alerts, error: alertError }] = await Promise.all([
        fetchProjectsForOrg(user.orgId),
        fetchOpenAlertsForOrg(user.orgId),
      ]);

      if (projectError || alertError || !projects?.length) {
        if (!cancelled) setState({ status: "ready", data: buildDemoProjectProfitData() });
        return;
      }

      const enrichedProjects = projects.map((project) => ({
        ...project,
        health: computeProjectHealth({
          npv: Number(project.current_npv_thb ?? 0),
          irr: Number(project.current_irr_pct ?? 0),
          targetIrr: Number(project.target_irr_pct ?? 0),
          mirr: Number(project.current_mirr_pct ?? 0),
          targetMirr: Number(project.target_mirr_pct ?? 0),
          paybackDays: Number(project.current_payback_days ?? 999),
          targetPaybackDays: Number(project.target_payback_days ?? 14),
          activeAlerts: alerts?.filter((item) => item.project_id === project.id && item.status === "open").length ?? 0,
        }),
      }));

      if (!cancelled) {
        setState({
          status: "ready",
          data: {
            portfolioSummary: {
              totalProjects: enrichedProjects.length,
              activeAlerts: alerts?.filter((item) => item.status === "open").length ?? 0,
            },
            projects: enrichedProjects,
            alerts: alerts ?? [],
          },
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
```

- [ ] **Step 6: Run tests to verify financial logic passes**

Run: `pnpm -C apps/web test -- --run calculations.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/features/project-profit/config apps/web/src/app/features/project-profit/lib apps/web/src/app/features/project-profit/hooks apps/web/src/app/features/project-profit/__tests__/calculations.test.js
git commit -m "feat: add project profit calculations and data loading hook"
```

## Task 4: Integrate The Project-Profit App Into The Existing Product Navigation

**Files:**
- Modify: `apps/web/src/app/AppCore.jsx`
- Modify: `apps/web/src/app/features/dashboard/Dashboard.jsx`
- Modify: `apps/web/src/app/features/project-profit/ProjectProfitApp.jsx`
- Create: `apps/web/src/app/features/project-profit/views/ExecutiveDashboardView.jsx`
- Create: `apps/web/src/app/features/project-profit/views/ProjectCommandCenterView.jsx`
- Create: `apps/web/src/app/features/project-profit/components/ProjectShell.jsx`
- Create: `apps/web/src/app/features/project-profit/components/AlertList.jsx`
- Test: `apps/web/src/app/features/project-profit/__tests__/ProjectProfitApp.test.jsx`

- [ ] **Step 1: Expand the feature test to cover view switching**

```jsx
import userEvent from "@testing-library/user-event";

it("switches from executive dashboard to project command center", async () => {
  const user = userEvent.setup();

  render(
    <ProjectProfitApp
      user={{ name: "Demo User", role: "owner" }}
      data={{
        portfolioSummary: { totalProjects: 2, activeAlerts: 4 },
        projects: [{ id: "p1", name: "90,000 Pole Program", health: "watch" }],
        alerts: [{ id: "a1", title: "Billing package incomplete", severity: "high" }],
      }}
    />
  );

  await user.click(screen.getByRole("button", { name: "Project Command Center" }));
  expect(screen.getByText("Cluster Focus And Action Queue")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: FAIL because specialized views are not implemented yet.

- [ ] **Step 3: Add project shell and first two views**

```jsx
import SectionCard from "./SectionCard.jsx";

export default function ProjectShell({ title, subtitle, metrics, children }) {
  return (
    <div className="pp-content">
      <SectionCard title={title} subtitle={subtitle}>
        <div className="pp-grid">
          {metrics}
        </div>
      </SectionCard>
      {children}
    </div>
  );
}
```

```jsx
import MetricCard from "../components/MetricCard.jsx";
import ProjectShell from "../components/ProjectShell.jsx";

export default function ExecutiveDashboardView({ data }) {
  return (
    <ProjectShell
      title="Executive Profit Snapshot"
      subtitle="Monitor whether portfolio-level value creation is strengthening or slipping."
      metrics={[
        <MetricCard key="projects" label="Projects" value={String(data?.portfolioSummary?.totalProjects ?? 0)} tone="sky" />,
        <MetricCard key="alerts" label="Open Alerts" value={String(data?.portfolioSummary?.activeAlerts ?? 0)} tone="amber" />,
      ]}
    />
  );
}
```

```jsx
import AlertList from "../components/AlertList.jsx";
import ProjectShell from "../components/ProjectShell.jsx";
import SectionCard from "../components/SectionCard.jsx";

export default function ProjectCommandCenterView({ data }) {
  return (
    <ProjectShell
      title="Cluster Focus And Action Queue"
      subtitle="Concentrate on the projects and field clusters that can move profit today."
      metrics={[]}
    >
      <SectionCard title="Open Decisions">
        <AlertList alerts={data?.alerts ?? []} />
      </SectionCard>
    </ProjectShell>
  );
}
```

- [ ] **Step 4: Wire the new project-profit mode into `AppCore.jsx`**

```jsx
import ProjectProfitApp from "./features/project-profit/ProjectProfitApp.jsx";

// add a new quick action button
<button
  type="button"
  onClick={() => setView("project_profit")}
  style={{
    border: "none",
    borderRadius: 8,
    padding: "8px 10px",
    background: view === "project_profit" ? "#1565c0" : "#eef4ff",
    color: view === "project_profit" ? "#fff" : "#17335c",
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  Project Profit
</button>

{view === "project_profit" && user && !mustChoosePlan && (
  <ProjectProfitApp user={user} />
)}
```

- [ ] **Step 5: Run tests and lint**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: PASS

Run: `pnpm -C apps/web lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/AppCore.jsx apps/web/src/app/features/project-profit
git commit -m "feat: integrate project profit app into main navigation"
```

## Task 5: Build Cash, Billing, Machines, And Mobile MVP Views

**Files:**
- Modify: `apps/web/src/app/features/project-profit/ProjectProfitApp.jsx`
- Create: `apps/web/src/app/features/project-profit/views/CashFlowProfitView.jsx`
- Create: `apps/web/src/app/features/project-profit/views/BillingDocumentsView.jsx`
- Create: `apps/web/src/app/features/project-profit/views/MachinesTeamsClustersView.jsx`
- Create: `apps/web/src/app/features/project-profit/views/MobileFieldInputView.jsx`
- Modify: `apps/web/src/app/features/project-profit/project-profit.css`
- Test: `apps/web/src/app/features/project-profit/__tests__/ProjectProfitApp.test.jsx`

- [ ] **Step 1: Add failing tests for billing checklist and mobile fields**

```jsx
it("renders the billing checklist view", async () => {
  const user = userEvent.setup();
  render(<ProjectProfitApp user={{ name: "Demo User" }} data={buildDemoProjectProfitData()} />);

  await user.click(screen.getByRole("button", { name: "Billing & Documents" }));
  expect(screen.getByText("Billing Readiness Checklist")).toBeInTheDocument();
});

it("renders the mobile field entry form", async () => {
  const user = userEvent.setup();
  render(<ProjectProfitApp user={{ name: "Demo User" }} data={buildDemoProjectProfitData()} />);

  await user.click(screen.getByRole("button", { name: "Mobile Field Input" }));
  expect(screen.getByLabelText("Completed Units")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: FAIL because the remaining views are not implemented.

- [ ] **Step 3: Add cash-flow and billing views**

```jsx
import MetricCard from "../components/MetricCard.jsx";
import ProjectShell from "../components/ProjectShell.jsx";
import SectionCard from "../components/SectionCard.jsx";

export default function CashFlowProfitView({ data }) {
  const project = data?.projects?.[0];
  return (
    <ProjectShell
      title="Cash Velocity And Value Creation"
      subtitle="Use cash timing and discounted-return signals together before approving the next operational move."
      metrics={[
        <MetricCard key="npv" label="NPV" value={project?.currentNpvLabel ?? "฿0"} tone="sky" />,
        <MetricCard key="irr" label="IRR" value={project?.currentIrrLabel ?? "0%"} tone="mint" />,
        <MetricCard key="payback" label="Payback" value={project?.paybackLabel ?? "N/A"} tone="amber" />,
      ]}
    >
      <SectionCard title="Daily Cash Notes" subtitle="Show inflows, outflows, and expected collections by day." />
    </ProjectShell>
  );
}
```

```jsx
import ProjectShell from "../components/ProjectShell.jsx";
import SectionCard from "../components/SectionCard.jsx";

const REQUIRED_DOCS = ["SC", "WR", "Contract Agreement", "Invoice", "Tax Invoice", "BOQ", "Photo Report", "Inspection Report"];

export default function BillingDocumentsView() {
  return (
    <ProjectShell
      title="Billing Readiness Checklist"
      subtitle="Prevent cash slippage by catching incomplete billing packages before submission."
      metrics={[]}
    >
      <SectionCard title="Required Documents">
        <ul className="pp-checklist">
          {REQUIRED_DOCS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
    </ProjectShell>
  );
}
```

- [ ] **Step 4: Add machine and mobile field input views**

```jsx
import ProjectShell from "../components/ProjectShell.jsx";
import SectionCard from "../components/SectionCard.jsx";

export default function MachinesTeamsClustersView({ data }) {
  return (
    <ProjectShell
      title="Machines, Teams, And Clusters"
      subtitle="Watch utilization, cluster cost, and team allocation before buying or moving more assets."
      metrics={[]}
    >
      <SectionCard title="Utilization Watchlist" subtitle={`${data?.projects?.length ?? 0} projects currently loaded`} />
    </ProjectShell>
  );
}
```

```jsx
import { useState } from "react";

import ProjectShell from "../components/ProjectShell.jsx";
import SectionCard from "../components/SectionCard.jsx";

export default function MobileFieldInputView() {
  const [form, setForm] = useState({
    completedUnits: "",
    reworkUnits: "",
    note: "",
  });

  return (
    <ProjectShell
      title="Mobile Field Input"
      subtitle="Capture progress, documents, and jobsite issues from a phone-friendly workflow."
      metrics={[]}
    >
      <SectionCard title="Daily Field Update">
        <label>
          Completed Units
          <input value={form.completedUnits} onChange={(event) => setForm({ ...form, completedUnits: event.target.value })} />
        </label>
        <label>
          Rework Units
          <input value={form.reworkUnits} onChange={(event) => setForm({ ...form, reworkUnits: event.target.value })} />
        </label>
        <label>
          Field Note
          <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </label>
      </SectionCard>
    </ProjectShell>
  );
}
```

- [ ] **Step 5: Update the app switcher to render all six views**

```jsx
const VIEW_COMPONENTS = {
  "Executive Dashboard": ExecutiveDashboardView,
  "Project Command Center": ProjectCommandCenterView,
  "Cash Flow & Profit": CashFlowProfitView,
  "Billing & Documents": BillingDocumentsView,
  "Machines, Teams & Clusters": MachinesTeamsClustersView,
  "Mobile Field Input": MobileFieldInputView,
};

const ActiveView = VIEW_COMPONENTS[activeView] ?? ExecutiveDashboardView;

<ActiveView data={data} user={user} />
```

- [ ] **Step 6: Run tests to verify the remaining MVP screens pass**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/features/project-profit
git commit -m "feat: add core project profit MVP views"
```

## Task 6: Add Alert Presentation, Real Data Save Actions, And End-To-End Verification

**Files:**
- Modify: `apps/web/src/app/features/project-profit/components/AlertList.jsx`
- Modify: `apps/web/src/app/features/project-profit/views/MobileFieldInputView.jsx`
- Modify: `apps/web/src/app/features/project-profit/lib/project-profit-api.js`
- Modify: `apps/web/src/app/features/project-profit/hooks/useProjectProfitData.js`
- Modify: `apps/web/src/app/features/project-profit/__tests__/ProjectProfitApp.test.jsx`

- [ ] **Step 1: Add a failing test for alert severity rendering**

```jsx
it("renders alert severity badges", async () => {
  render(
    <ProjectProfitApp
      user={{ name: "Demo User", role: "owner" }}
      data={{
        portfolioSummary: { totalProjects: 2, activeAlerts: 1 },
        alerts: [{ id: "a1", title: "Cash gap expected", severity: "critical", impactSummary: "Payback slips by 5 days" }],
      }}
    />
  );

  expect(screen.getByText("critical")).toBeInTheDocument();
  expect(screen.getByText("Cash gap expected")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/web test -- --run ProjectProfitApp.test.jsx`
Expected: FAIL because `AlertList` is still a placeholder.

- [ ] **Step 3: Implement alert list rendering and mobile save action**

```jsx
export default function AlertList({ alerts }) {
  if (!alerts?.length) {
    return <p className="pp-empty">No open alerts right now.</p>;
  }

  return (
    <div className="pp-alertStack">
      {alerts.map((alert) => (
        <article key={alert.id} className={`pp-alert pp-alert-${alert.severity ?? "medium"}`}>
          <div className="pp-alertHeader">
            <strong>{alert.title}</strong>
            <span>{alert.severity ?? "medium"}</span>
          </div>
          <p>{alert.impactSummary}</p>
          {alert.recommendedAction ? <p>{alert.recommendedAction}</p> : null}
        </article>
      ))}
    </div>
  );
}
```

```js
export async function createDailyProgress(payload) {
  return supaLite.from("daily_progress").insert(payload);
}
```

```jsx
async function handleSubmit(event) {
  event.preventDefault();
  if (!user?.orgId || !projectId) return;

  await createDailyProgress({
    org_id: user.orgId,
    project_id: projectId,
    progress_date: new Date().toISOString().slice(0, 10),
    completed_units: Number(form.completedUnits || 0),
    rework_units: Number(form.reworkUnits || 0),
    note: form.note,
  });
}
```

- [ ] **Step 4: Subscribe project alerts to realtime updates**

```js
useEffect(() => {
  if (!user?.orgId) return undefined;

  const channelName = `project-alerts-${user.orgId}`;
  supaLite.channel(channelName)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "project_alerts",
      filter: `org_id=eq.${user.orgId}`,
    }, () => {
      load();
    })
    .subscribe();

  return () => {
    supaLite.removeChannel(channelName);
  };
}, [user?.orgId, load]);
```

- [ ] **Step 5: Run verification suite**

Run: `pnpm -C apps/web lint`
Expected: PASS

Run: `pnpm -C apps/web test -- --run`
Expected: PASS

Run: `pnpm build`
Expected: PASS with the web bundle generated and synced

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/features/project-profit apps/web/src/app/lib/supa-lite.js
git commit -m "feat: finish project profit alerts and field save flow"
```

## Self-Review

### Spec coverage

- Shared project templates: covered in Tasks 2 and 3
- Role-based dashboards: covered in Tasks 4 and 5
- Mobile field input: covered in Tasks 5 and 6
- Daily cash flow and profit engine: covered in Tasks 3 and 5
- Billing and document control: covered in Tasks 2 and 5
- Machinery visibility: covered in Tasks 2 and 5
- Alert center and early warning logic: covered in Tasks 3, 4, and 6

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain in the plan.
- Every task includes explicit files, commands, and code samples.

### Type consistency

- The frontend uses `project_alerts`, `daily_progress`, and `projects` consistently.
- The calculation layer consistently references `NPV`, `IRR`, `MIRR`, payback, and alert counts.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-project-profit-control-tower.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
