import { describe, expect, it } from "vitest";

import {
  buildDemoProjectProfitData,
  buildProjectProfitViewData,
} from "../lib/demo-data.js";
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

  it("normalizes demo payloads into the shared project view model", () => {
    const data = buildDemoProjectProfitData();
    const project = data.projects[0];
    const alert = data.alerts[0];

    expect(data.source).toBe("demo");
    expect(project).toMatchObject({
      source: "demo",
      templateId: "template-pole-13602",
      currentNpvThb: 128000,
      targetIrrPct: 37.8,
      currentNpvLabel: "THB 128,000",
      currentIrrLabel: "39.4%",
    });
    expect(alert).toMatchObject({
      source: "demo",
      projectId: "project-pole-13602",
      impactSummary: "Submission is blocked until the work report and invoice set are complete.",
    });
  });

  it("returns an empty real-state payload when a real org has no live projects", () => {
    expect(
      buildProjectProfitViewData({
        source: "live",
        projects: [],
        alerts: [],
        templates: [],
      })
    ).toMatchObject({
      source: "live",
      portfolioSummary: {
        totalProjects: 0,
        activeAlerts: 0,
      },
      projects: [],
      alerts: [],
    });
  });

  it("keeps only open alerts in the normalized live payload", () => {
    const data = buildProjectProfitViewData({
      source: "live",
      projects: [{ id: "project-live-1", name: "Live Project", features: {} }],
      alerts: [
        {
          id: "alert-open",
          project_id: "project-live-1",
          status: "open",
          title: "Open alert",
          impact_summary: "Needs attention",
          recommended_action: "Review this today",
        },
        {
          id: "alert-resolved",
          project_id: "project-live-1",
          status: "resolved",
          title: "Resolved alert",
          impact_summary: "Already handled",
          recommended_action: "No action needed",
        },
      ],
      templates: [],
    });

    expect(data.portfolioSummary.activeAlerts).toBe(1);
    expect(data.alerts).toHaveLength(1);
    expect(data.projects[0].activeAlerts).toBe(1);
    expect(data.alerts[0]).toMatchObject({
      id: "alert-open",
      status: "open",
      source: "live",
    });
  });
});
