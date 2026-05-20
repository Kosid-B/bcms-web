# Project Profit Control Tower Design

**Date:** 2026-05-20
**Status:** Proposed and user-approved design
**Source context:** User-approved design for a SaaS that helps multi-role teams manage project profitability, cash flow, machinery, billing, and field execution for projects such as the 13,602-pole and 90,000-pole programs.

## 1. Product Goal

Build a SaaS control tower that helps project teams achieve target profit by continuously connecting field execution, machinery usage, billing discipline, and daily cash flow to the project's financial performance.

The product must support both the 13,602-pole and 90,000-pole project structures through a shared project template model, while remaining reusable for future projects.

## 2. Core Business Outcomes

The system is successful when it helps users:

1. Keep project `NPV` positive.
2. Monitor and improve `IRR` and `MIRR` against target thresholds.
3. Protect daily liquidity and cash recovery targets, including the 14-day payback objective where configured.
4. Control machinery investment, utilization, and phased deployment.
5. Prevent billing delays caused by incomplete documents or poor process discipline.
6. Detect cost and cash-flow risks early enough to act before profit drops below target.

## 3. Product Positioning

This product is not just a dashboard and not just a document repository. It is a `Project Profit Control Tower` with a finance-first operating model.

The product center is:

- `NPV + IRR/MIRR` as the strategic financial decision layer
- `daily cash flow` as the operational financial reality layer
- project execution, machinery, logistics, and billing as the drivers that move those metrics

## 4. Scope Model

The platform must support a reusable template that can be applied to:

- the `13,602` pole project
- the `90,000` pole project
- future projects with different scale, geography, machinery, billing rules, and profit targets

Each project can define its own:

- project volume and units
- target profit and margin thresholds
- discount rate
- hurdle rate
- reinvestment assumptions for `MIRR`
- target payback days
- machinery budget and phased investment plan
- cluster and province strategy
- billing calendar and document rules
- cost baseline by workstream

## 5. User Roles

The system serves multiple roles with shared data and role-specific views.

### 5.1 Owner / Executive

Primary need:

- See portfolio-level profitability, cash position, project risk, and decisions required.

Primary view:

- Executive dashboard with profit, `NPV`, `IRR`, `MIRR`, cash health, high-risk projects, underperforming clusters, and asset efficiency.

### 5.2 Project Manager

Primary need:

- Control project delivery and react to cost, billing, machinery, and progress variance.

Primary view:

- Project command center with project summary, cluster progress, cost variance, billing bottlenecks, asset bottlenecks, and action queue.

### 5.3 Site Admin / Document Admin

Primary need:

- Submit clean field and billing data with low rejection risk.

Primary view:

- Fast workflow screens for upload, checklist completion, billing package readiness, and document issue resolution.

### 5.4 Operations / Logistics

Primary need:

- Improve route, cluster execution, lead time, machinery deployment, and reduce rework and waste.

Primary view:

- Operational planning and field efficiency pages focused on clusters, utilization, delays, and logistics cost.

### 5.5 Finance Controller

Primary need:

- Protect cash flow and billing discipline.

Primary view:

- Cash flow, receivables, billing status, expected collection timing, and impact analysis on payback and profitability.

## 6. MVP Screens

The minimum viable product should include these primary surfaces:

1. `Executive Dashboard`
2. `Project Command Center`
3. `Cash Flow & Profit`
4. `Billing & Documents`
5. `Machines, Teams & Clusters`
6. `Mobile Field Input`

## 7. Input Channels

The product must accept information through multiple channels.

### 7.1 Initial channels

- Manual entry in the web application
- Mobile entry from field users
- File uploads such as Excel, PDF, and document images

### 7.2 Future channels

- External system integrations
- Automated extraction and normalization pipelines

## 8. Mobile Capability

Mobile input is a required part of the design, not a future nice-to-have.

In the MVP, mobile should support:

1. Daily progress entry
2. Photo and document upload
3. Billing checklist confirmation
4. Issue reporting and alert acknowledgment
5. Machinery usage and field status updates

The mobile experience should be task-first and lightweight. Executives and analysts may still prefer desktop for deeper financial review, but field-originated data should enter through mobile-friendly flows.

## 9. Core Modules

### 9.1 Portfolio + Project Setup

Used to define templates and instantiate projects such as the 13,602-pole and 90,000-pole programs.

Responsibilities:

- project creation
- template management
- target and threshold configuration
- cluster and province planning inputs
- baseline cost setup
- billing rule setup

### 9.2 Daily Cash Flow

Responsibilities:

- capture daily inflows and outflows
- track expected cash receipts
- show cash gaps, collection timing, and payback status

### 9.3 Profit Engine

Responsibilities:

- compute `NPV`, `IRR`, `MIRR`, margin, and payback forecasts
- compare actual performance against target
- reflect downstream effects from execution, billing, and machinery changes

### 9.4 Machine & Asset Control

Responsibilities:

- machinery registry
- phased investment planning
- utilization tracking
- downtime and maintenance logging
- unit cost analysis by project or cluster

### 9.5 Billing & Document Control

Responsibilities:

- billing package readiness
- document completeness validation
- billing cycle tracking
- rejected billing root-cause tracking
- receivables and expected payment timing

### 9.6 Operational Cost & Cluster Planning

Responsibilities:

- track cluster performance
- monitor team throughput
- track logistics cost and route efficiency
- monitor rework, defect, waiting, and waste patterns

### 9.7 Alerts & Decision Support

Responsibilities:

- detect early risk to cash or profit
- explain impact
- assign action owners
- support decision-making with recommended next steps

## 10. Core Data Domains

The product needs eight connected data domains.

### 10.1 Project Master

Contains:

- project metadata
- unit volume
- target profit
- target `NPV`
- target `IRR`
- target `MIRR`
- hurdle and discount rates
- target payback
- billing rules
- clusters and provinces
- financial baselines

### 10.2 Work Progress

Contains:

- daily or periodic installed quantities
- area or cluster
- responsible team
- planned vs actual progress
- rework
- defects
- wait time
- productivity metrics

### 10.3 Cash Transactions

Contains:

- actual cash out
- actual cash in
- expected receipts
- machinery investment
- labor
- materials
- transport
- rework and indirect cost entries

### 10.4 Billing Cycle

Contains:

- billing batch or cycle
- submission date
- status
- rejection reason
- approval date
- credit term
- expected collection date
- actual collection date

### 10.5 Document Registry

Contains tracked records for:

- `SC`
- `WR`
- contract agreement
- invoice
- billing statement
- receipt / tax invoice
- `BOQ`
- photo report
- inspection report
- tax registration and company certification
- bank account proof
- related supporting records

### 10.6 Machines & Assets

Contains:

- asset identity
- investment phase
- acquisition value
- active cluster or project assignment
- utilization
- downtime
- maintenance
- capacity risk
- operating cost

### 10.7 Teams & Clusters

Contains:

- team identity
- skill specialization
- assigned area
- cluster
- productivity
- waiting time
- defect and rework rate

### 10.8 Alerts & Decisions

Contains:

- alert type
- severity
- trigger cause
- financial impact
- owner
- due date
- resolution status
- post-resolution outcome

## 11. KPI Framework

The KPI model should have three layers.

### 11.1 Financial Core

- `NPV`
- `IRR`
- `MIRR`
- gross margin
- net margin
- payback period
- cash conversion cycle
- planned vs actual profit

### 11.2 Execution Core

- progress per cluster
- cost per installed unit
- rework rate
- machinery utilization
- logistics cost per shipment or route
- lead time
- billing rejection rate

### 11.3 Early Warning Core

- days to cash shortfall
- overdue billing amount
- missing-document exposure
- cost overrun trend
- underperforming cluster
- low-utilization asset risk
- delayed collection impact on `NPV`

## 12. Data Flow Design

The system should process information through four layers.

### 12.1 Input Layer

Sources:

- desktop data entry
- mobile data entry
- spreadsheet uploads
- PDF uploads
- image uploads

Purpose:

- ingest field, finance, asset, and billing information in standard forms

### 12.2 Validation Layer

Purpose:

- verify completeness, consistency, and business-rule compliance before the data influences decisions

Examples:

- billing package missing required documents
- transport cost above baseline threshold
- installed quantity inconsistent with manpower or machinery
- machinery allocated beyond safe or expected capacity

### 12.3 Financial Intelligence Layer

Purpose:

- recalculate profitability and cash metrics whenever validated data changes

Outputs:

- updated `cash flow`
- updated `NPV`
- updated `IRR`
- updated `MIRR`
- variance analysis
- payback forecast
- risk scores

### 12.4 Action Layer

Purpose:

- translate issues into accountable next steps for users

Examples:

- missing billing documents to complete
- cluster cost overrun to investigate
- machinery purchase to delay
- team reassignment to improve output
- billing package to prioritize before the next cycle closes

## 13. Alert Logic

The alerting system must identify both root causes and business consequences.

### 13.1 Cash Risk Alerts

Trigger examples:

- expected receipts delayed
- missing billing documents
- submission missed billing window
- credit term nearing breach
- projected cash gap

System response:

- quantify collection risk
- estimate payback slippage
- identify responsible owner and next action

### 13.2 Profit Risk Alerts

Trigger examples:

- cost exceeds baseline
- rework trend increases
- machinery utilization falls
- logistics cost overruns
- underperforming cluster output

System response:

- quantify impact on margin and strategic financial metrics
- link operational driver to projected financial deterioration

### 13.3 Decision Alerts

Trigger examples:

- phase-three machinery purchase no longer justified
- specialized team should move to a high-density province
- one billing batch should be prioritized ahead of another
- low-cost shipping option would materially reduce cost

System response:

- recommend actionable alternatives tied to likely financial outcome

Each alert must answer:

1. What happened?
2. What is the likely impact on profit or cash?
3. What should the team do now?

## 14. MVP Scope

The MVP should focus on the narrowest release that can materially improve profitability management.

### 14.1 Included in MVP

1. Shared project templates for 13,602 and 90,000 style projects
2. Role-based dashboards
3. Mobile-friendly field input
4. Daily cash flow tracking and forecasting
5. Profit engine with `NPV`, `IRR`, `MIRR`, margin, and payback visibility
6. Billing and document readiness workflows
7. Machinery investment and usage visibility
8. Central alert center with actionable recommendations

### 14.2 Deferred until after MVP

1. Full OCR / AI extraction automation
2. Deep ERP or accounting integrations
3. Advanced scenario simulation across multiple future cases
4. Native mobile applications if responsive web or PWA covers the initial need

## 15. Technical Design Direction

The current repository already contains a Vite + React web application and Supabase-backed SaaS foundation. The new capability should be added by extending that foundation rather than replacing it.

### 15.1 Frontend Direction

Add a new feature area under:

- `apps/web/src/app/features/project-profit/`

Recommended internal segmentation:

- dashboard
- cash-flow
- billing
- machines
- clusters
- alerts
- mobile-entry
- shared calculation-aware UI components

### 15.2 Backend / Data Direction

Extend Supabase schema with project-profit domain entities such as:

- `projects`
- `project_templates`
- `project_clusters`
- `daily_progress`
- `cash_entries`
- `billing_cycles`
- `billing_documents`
- `machines`
- `machine_usage`
- `alerts`
- `profit_snapshots`

### 15.3 Calculation Layer Direction

Create a shared service layer that centralizes:

- `NPV`
- `IRR`
- `MIRR`
- payback
- cost variance
- risk scoring

This logic must be reused across all screens so users never see conflicting financial outputs.

### 15.4 Mobile Direction

Start with responsive web or PWA behavior rather than a separate native app. The design should prioritize fast, low-friction task entry for field users.

### 15.5 Permission Direction

Use the existing role and access model as the base, then extend it for project-profit modules so each role sees only relevant views and actions.

## 16. Non-Goals

The first release should not attempt to become:

- a full ERP replacement
- a general-purpose accounting suite
- a complete native mobile ecosystem
- an all-at-once integration hub

The goal is focused operational finance control for project profitability.

## 17. Design Summary

This design creates a finance-first, operations-aware SaaS platform that connects field execution to strategic profitability outcomes. It supports multiple project scales, multiple user roles, mobile-first field collection, and early-warning decision support. The defining behavior of the system is not passive reporting but active prevention of profit leakage through cash, cost, machinery, logistics, and billing signals.
