import { describe, expect, it } from "vitest";

import { INSTALLATION_DEMO_DATA } from "../lib/demo-data.js";
import {
  buildInstallationPlanningView,
  canManageInstallationPlans,
  computeInstallationMetrics,
  filterInstallationPlans,
  normalizeInstallationPayload,
} from "../lib/installation-planning.js";

describe("installation planning helpers", () => {
  it("lets owners, admins, and executives manage plans", () => {
    expect(canManageInstallationPlans({ role: "owner" })).toBe(true);
    expect(canManageInstallationPlans({ role: "admin" })).toBe(true);
    expect(canManageInstallationPlans({ role: "executive" })).toBe(true);
    expect(canManageInstallationPlans({ role: "member" })).toBe(false);
  });

  it("normalizes optional empty fields before saving to Postgres", () => {
    expect(normalizeInstallationPayload("plan", {
      name: "แผนทดสอบ",
      start_date: "",
      end_date: "",
      notes: "",
    })).toEqual({
      name: "แผนทดสอบ",
      start_date: null,
      end_date: null,
      notes: null,
    });

    expect(normalizeInstallationPayload("point", {
      team_id: "",
      assigned_date: "",
      latitude: "15.123456",
      longitude: "104.123456",
      target_units: "12",
    })).toEqual({
      team_id: null,
      assigned_date: null,
      latitude: 15.123456,
      longitude: 104.123456,
      target_units: 12,
    });
  });

  it("joins teams and points into plan summaries", () => {
    const view = buildInstallationPlanningView(INSTALLATION_DEMO_DATA);

    expect(view.plans).toHaveLength(2);
    expect(view.plans[0].points[0].team_name).toBe("ทีมติดตั้ง A");
    expect(view.teams[0].leader.full_name).toBe("ประสิทธิ์ ศรีสุข");
  });

  it("filters plans by team and computes operational metrics", () => {
    const view = buildInstallationPlanningView(INSTALLATION_DEMO_DATA);
    const filtered = filterInstallationPlans(view, { teamId: "team-bravo" });
    const metrics = computeInstallationMetrics(view, new Date("2026-06-22T12:00:00Z"));

    expect(filtered).toHaveLength(1);
    expect(filtered[0].points).toHaveLength(1);
    expect(metrics.activePlans).toBe(2);
    expect(metrics.totalPoints).toBe(3);
    expect(metrics.scheduledToday).toBe(1);
  });
});
