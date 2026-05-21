import { DEFAULT_PROJECT_TEMPLATES } from "../config/defaultProjectTemplates.js";
import {
  computePaybackDays,
  computeProjectHealth,
  computeVariancePct,
} from "./calculations.js";
import { formatCurrencyThb, formatDays, formatPercent } from "./formatters.js";

const DEMO_ALERTS = [
  {
    id: "alert-billing-package",
    project_id: "project-pole-13602",
    status: "open",
    severity: "high",
    title: "Billing package incomplete",
    impact_summary:
      "Submission is blocked until the work report and invoice set are complete.",
    recommended_action:
      "Collect the missing billing documents before the next client billing window.",
  },
  {
    id: "alert-payback-slip",
    project_id: "project-pole-90000",
    status: "open",
    severity: "critical",
    title: "Cash recovery is slipping",
    impact_summary: "Delayed collections push payback beyond the target window.",
    recommended_action:
      "Escalate collection follow-up and re-sequence field work with lower cash burn.",
  },
  {
    id: "alert-machine-usage",
    project_id: "project-pole-90000",
    status: "open",
    severity: "medium",
    title: "Machinery utilization below plan",
    impact_summary: "Idle equipment is diluting project margin.",
    recommended_action:
      "Reassign underused equipment to the highest-yield cluster this week.",
  },
];

const DEMO_PROJECT_SERIES = {
  "template-pole-13602": [-98000, 70000, 40000],
  "template-pole-90000": [-650000, 180000, 160000, 155000, 130000],
};

const DEMO_PROJECT_METRICS = {
  "template-pole-13602": {
    id: "project-pole-13602",
    currentUnits: 14960,
    currentNpvThb: 128000,
    currentIrrPct: 39.4,
    currentMirrPct: 25.1,
  },
  "template-pole-90000": {
    id: "project-pole-90000",
    currentUnits: 81250,
    currentNpvThb: -42000,
    currentIrrPct: 21.6,
    currentMirrPct: 18.4,
  },
};

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const numericValue = toFiniteNumber(value);

    if (numericValue !== null) {
      return numericValue;
    }
  }

  return null;
}

function buildTemplateViewModel(template = {}) {
  return {
    id: template.id ?? null,
    name: template.name ?? "Untitled Project",
    unitLabel: template.unitLabel ?? template.unit_label ?? "units",
    targetUnits:
      firstFiniteNumber(template.targetUnits, template.target_units) ?? 0,
    targetProfitThb:
      firstFiniteNumber(template.targetProfitThb, template.target_profit_thb) ??
      0,
    targetMarginPct:
      firstFiniteNumber(template.targetMarginPct, template.target_margin_pct) ??
      0,
    targetNpvThb:
      firstFiniteNumber(template.targetNpvThb, template.target_npv_thb) ?? 0,
    targetIrrPct:
      firstFiniteNumber(
        template.targetIrrPct,
        template.targetIrr,
        template.target_irr_pct
      ) ?? 0,
    targetMirrPct:
      firstFiniteNumber(
        template.targetMirrPct,
        template.targetMirr,
        template.target_mirr_pct
      ) ?? 0,
    targetPaybackDays:
      firstFiniteNumber(
        template.targetPaybackDays,
        template.target_payback_days
      ) ?? 14,
    machineryBudgetThb:
      firstFiniteNumber(
        template.machineryBudgetThb,
        template.machinery_budget_thb
      ) ?? 0,
  };
}

function normalizeAlert(alert, source = "live") {
  const orgId = alert?.orgId ?? alert?.org_id ?? null;
  const projectId = alert?.projectId ?? alert?.project_id ?? null;
  const clusterId = alert?.clusterId ?? alert?.cluster_id ?? null;
  const impactSummary = alert?.impactSummary ?? alert?.impact_summary ?? "";
  const recommendedAction =
    alert?.recommendedAction ?? alert?.recommended_action ?? "";
  const dueDate = alert?.dueDate ?? alert?.due_date ?? null;
  const status = alert?.status ?? "open";

  return {
    id: alert?.id ?? null,
    source,
    orgId,
    org_id: orgId,
    projectId,
    project_id: projectId,
    clusterId,
    cluster_id: clusterId,
    severity: alert?.severity ?? "medium",
    alertType: alert?.alertType ?? alert?.alert_type ?? null,
    alert_type: alert?.alertType ?? alert?.alert_type ?? null,
    title: alert?.title ?? "",
    impactSummary,
    impact_summary: impactSummary,
    recommendedAction,
    recommended_action: recommendedAction,
    status,
    dueDate,
    due_date: dueDate,
  };
}

function buildProjectHealthStatus({
  activeAlerts,
  currentNpvThb,
  currentIrrPct,
  targetIrrPct,
  currentMirrPct,
  targetMirrPct,
  currentPaybackDays,
  targetPaybackDays,
}) {
  const hasFinancialSignal = [
    currentNpvThb,
    currentIrrPct,
    currentMirrPct,
    currentPaybackDays,
  ].some((value) => value !== null);

  if (!hasFinancialSignal) {
    if (activeAlerts >= 5) {
      return "critical";
    }

    if (activeAlerts > 0) {
      return "watch";
    }

    return "healthy";
  }

  return computeProjectHealth({
    npv: currentNpvThb ?? 0,
    irr: currentIrrPct ?? 0,
    targetIrr: targetIrrPct ?? 0,
    mirr: currentMirrPct ?? 0,
    targetMirr: targetMirrPct ?? 0,
    paybackDays: currentPaybackDays,
    targetPaybackDays: targetPaybackDays ?? 14,
    activeAlerts,
  });
}

function normalizeProject({ project, template, alerts = [], source = "live" }) {
  const normalizedTemplate = buildTemplateViewModel(template);
  const features =
    project?.features && typeof project.features === "object"
      ? project.features
      : {};
  const metrics =
    features.metrics && typeof features.metrics === "object"
      ? features.metrics
      : {};
  const cashSeries =
    project?.cashSeries ??
    project?.cash_series ??
    features.cashSeries ??
    features.cash_series ??
    metrics.cashSeries ??
    metrics.cash_series ??
    [];
  const currentUnits =
    firstFiniteNumber(
      project?.currentUnits,
      project?.current_units,
      features.currentUnits,
      features.current_units,
      metrics.currentUnits,
      metrics.current_units
    ) ?? 0;
  const currentCashBalanceThb =
    firstFiniteNumber(
      project?.currentCashBalanceThb,
      project?.current_cash_balance_thb
    ) ?? 0;
  const currentNpvThb = firstFiniteNumber(
    project?.currentNpvThb,
    project?.current_npv_thb,
    features.currentNpvThb,
    features.current_npv_thb,
    metrics.currentNpvThb,
    metrics.current_npv_thb
  );
  const currentIrrPct = firstFiniteNumber(
    project?.currentIrrPct,
    project?.current_irr_pct,
    features.currentIrrPct,
    features.current_irr_pct,
    metrics.currentIrrPct,
    metrics.current_irr_pct
  );
  const currentMirrPct = firstFiniteNumber(
    project?.currentMirrPct,
    project?.current_mirr_pct,
    features.currentMirrPct,
    features.current_mirr_pct,
    metrics.currentMirrPct,
    metrics.current_mirr_pct
  );

  let currentPaybackDays = firstFiniteNumber(
    project?.currentPaybackDays,
    project?.current_payback_days,
    features.currentPaybackDays,
    features.current_payback_days,
    metrics.currentPaybackDays,
    metrics.current_payback_days
  );

  if (currentPaybackDays === null && Array.isArray(cashSeries) && cashSeries.length > 0) {
    currentPaybackDays = computePaybackDays(cashSeries);
  }

  const activeAlerts = alerts.length;
  const targetUnits = normalizedTemplate.targetUnits;
  const targetPaybackDays = normalizedTemplate.targetPaybackDays;
  const health = buildProjectHealthStatus({
    activeAlerts,
    currentNpvThb,
    currentIrrPct,
    targetIrrPct: normalizedTemplate.targetIrrPct,
    currentMirrPct,
    targetMirrPct: normalizedTemplate.targetMirrPct,
    currentPaybackDays,
    targetPaybackDays,
  });
  const orgId = project?.orgId ?? project?.org_id ?? null;
  const templateId =
    project?.templateId ?? project?.template_id ?? normalizedTemplate.id;
  const startDate = project?.startDate ?? project?.start_date ?? null;
  const endDate = project?.endDate ?? project?.end_date ?? null;

  return {
    id: project?.id ?? null,
    source,
    orgId,
    org_id: orgId,
    templateId,
    template_id: templateId,
    name: project?.name ?? normalizedTemplate.name,
    code: project?.code ?? null,
    status: project?.status ?? "draft",
    startDate,
    start_date: startDate,
    endDate,
    end_date: endDate,
    unitLabel: normalizedTemplate.unitLabel,
    targetUnits,
    currentUnits,
    variancePct: computeVariancePct(currentUnits, targetUnits),
    machineryBudgetThb: normalizedTemplate.machineryBudgetThb,
    currentCashBalanceThb,
    current_cash_balance_thb: currentCashBalanceThb,
    currentNpvThb,
    current_npv_thb: currentNpvThb,
    currentIrrPct,
    current_irr_pct: currentIrrPct,
    currentMirrPct,
    current_mirr_pct: currentMirrPct,
    currentPaybackDays,
    current_payback_days: currentPaybackDays,
    targetProfitThb: normalizedTemplate.targetProfitThb,
    target_profit_thb: normalizedTemplate.targetProfitThb,
    targetMarginPct: normalizedTemplate.targetMarginPct,
    target_margin_pct: normalizedTemplate.targetMarginPct,
    targetNpvThb: normalizedTemplate.targetNpvThb,
    target_npv_thb: normalizedTemplate.targetNpvThb,
    targetIrrPct: normalizedTemplate.targetIrrPct,
    target_irr_pct: normalizedTemplate.targetIrrPct,
    targetMirrPct: normalizedTemplate.targetMirrPct,
    target_mirr_pct: normalizedTemplate.targetMirrPct,
    targetPaybackDays,
    target_payback_days: targetPaybackDays,
    currentCashBalanceLabel: formatCurrencyThb(currentCashBalanceThb),
    currentNpvLabel: formatCurrencyThb(currentNpvThb),
    currentIrrLabel: formatPercent(currentIrrPct),
    currentMirrLabel: formatPercent(currentMirrPct),
    paybackLabel: formatDays(currentPaybackDays),
    health,
    activeAlerts,
    features,
  };
}

function buildDemoProjects() {
  return DEFAULT_PROJECT_TEMPLATES.map((template) => {
    const metrics = DEMO_PROJECT_METRICS[template.id];

    return {
      id: metrics.id,
      template_id: template.id,
      name: template.name,
      code: template.id.replace("template-", "demo-"),
      status: "active",
      current_cash_balance_thb: 0,
      features: {
        current_units: metrics.currentUnits,
        current_npv_thb: metrics.currentNpvThb,
        current_irr_pct: metrics.currentIrrPct,
        current_mirr_pct: metrics.currentMirrPct,
        cash_series: DEMO_PROJECT_SERIES[template.id] ?? [],
      },
    };
  });
}

export function buildProjectProfitViewData({
  source = "live",
  projects = [],
  alerts = [],
  templates = [],
} = {}) {
  const normalizedAlerts = (alerts ?? [])
    .map((alert) => normalizeAlert(alert, source))
    .filter((alert) => alert.status === "open");
  const templateLookup = Object.fromEntries(
    (templates ?? [])
      .map((template) => buildTemplateViewModel(template))
      .filter((template) => template.id)
      .map((template) => [template.id, template])
  );
  const normalizedProjects = (projects ?? []).map((project) => {
    const templateId = project?.templateId ?? project?.template_id ?? null;
    const projectAlerts = normalizedAlerts.filter(
      (alert) => alert.projectId === project?.id
    );

    return normalizeProject({
      project,
      template: templateLookup[templateId],
      alerts: projectAlerts,
      source,
    });
  });

  return {
    source,
    isDemo: source === "demo",
    portfolioSummary: {
      totalProjects: normalizedProjects.length,
      activeAlerts: normalizedAlerts.length,
    },
    projects: normalizedProjects,
    alerts: normalizedAlerts,
  };
}

export function buildDemoProjectProfitData() {
  return buildProjectProfitViewData({
    source: "demo",
    projects: buildDemoProjects(),
    alerts: DEMO_ALERTS,
    templates: DEFAULT_PROJECT_TEMPLATES,
  });
}
