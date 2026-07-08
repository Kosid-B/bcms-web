export const PLAN_STATUS_LABELS = {
  draft: "ฉบับร่าง",
  ready: "พร้อมดำเนินงาน",
  in_progress: "กำลังติดตั้ง",
  completed: "เสร็จสิ้น",
};

export const POINT_STATUS_LABELS = {
  planned: "วางแผนแล้ว",
  assigned: "มอบหมายแล้ว",
  in_progress: "กำลังติดตั้ง",
  done: "เสร็จสิ้น",
  blocked: "ติดปัญหา",
};

export const TEAM_TYPE_LABELS = {
  installation: "ทีมติดตั้ง",
  foundation: "ทีมฐานราก",
  inspection: "ทีมตรวจรับ",
  transport: "ทีมขนส่ง",
};

export function canManageInstallationPlans(user) {
  return ["owner", "admin", "executive", "super_admin"].includes(
    String(user?.role ?? "").toLowerCase(),
  );
}

export function normalizeInstallationPayload(kind, form) {
  const payload = { ...form };
  const nullableFields = {
    team: ["leader_profile_id", "assigned_work"],
    plan: ["start_date", "end_date", "notes"],
    point: [
      "team_id",
      "point_code",
      "district",
      "subdistrict",
      "assigned_date",
      "notes",
    ],
  };

  (nullableFields[kind] ?? []).forEach((field) => {
    if (payload[field] === "") payload[field] = null;
  });

  if (kind === "team") payload.crew_size = Number(payload.crew_size || 1);
  if (kind === "point") {
    payload.target_units = Number(payload.target_units || 0);
    payload.latitude = payload.latitude === "" ? null : Number(payload.latitude);
    payload.longitude = payload.longitude === "" ? null : Number(payload.longitude);
  }

  return payload;
}

export function buildInstallationPlanningView({
  projects = [],
  teams = [],
  plans = [],
  points = [],
  profiles = [],
}) {
  const projectMap = new Map(projects.map((item) => [item.id, item]));
  const teamMap = new Map(teams.map((item) => [item.id, item]));
  const profileMap = new Map(profiles.map((item) => [item.id, item]));
  const pointsByPlan = new Map();

  points.forEach((point) => {
    const team = teamMap.get(point.team_id) ?? null;
    const rows = pointsByPlan.get(point.plan_id) ?? [];
    rows.push({
      ...point,
      team,
      team_name: team?.name ?? "ยังไม่กำหนดทีม",
    });
    pointsByPlan.set(point.plan_id, rows);
  });

  const normalizedTeams = teams.map((team) => ({
    ...team,
    project: projectMap.get(team.project_id) ?? null,
    leader: profileMap.get(team.leader_profile_id) ?? null,
  }));

  const normalizedPlans = plans.map((plan) => ({
    ...plan,
    project: projectMap.get(plan.project_id) ?? null,
    points: pointsByPlan.get(plan.id) ?? [],
  }));

  return {
    projects,
    profiles,
    teams: normalizedTeams,
    plans: normalizedPlans,
    points: normalizedPlans.flatMap((plan) => plan.points),
  };
}

export function computeInstallationMetrics(view, today = new Date()) {
  const dateKey = today.toISOString().slice(0, 10);
  const points = view?.points ?? [];

  return {
    activePlans: (view?.plans ?? []).filter((plan) =>
      ["ready", "in_progress"].includes(plan.status),
    ).length,
    totalPoints: points.length,
    assignedPoints: points.filter((point) => Boolean(point.team_id)).length,
    blockedPoints: points.filter((point) => point.status === "blocked").length,
    scheduledToday: points.filter((point) => point.assigned_date === dateKey).length,
    completedUnits: points
      .filter((point) => point.status === "done")
      .reduce((total, point) => total + Number(point.target_units || 0), 0),
  };
}

export function filterInstallationPlans(view, filters = {}) {
  const query = String(filters.query ?? "").trim().toLocaleLowerCase("th-TH");

  return (view?.plans ?? [])
    .map((plan) => ({
      ...plan,
      points: plan.points.filter((point) => {
        if (filters.teamId && point.team_id !== filters.teamId) return false;
        if (filters.pointStatus && point.status !== filters.pointStatus) return false;
        if (query) {
          const haystack = [
            point.point_code,
            point.name,
            point.location_text,
            point.province,
            point.district,
            point.team_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("th-TH");
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    }))
    .filter((plan) => {
      if (filters.projectId && plan.project_id !== filters.projectId) return false;
      if (filters.province && plan.province !== filters.province) return false;
      if (filters.planStatus && plan.status !== filters.planStatus) return false;
      if ((filters.teamId || filters.pointStatus || query) && plan.points.length === 0) return false;
      return true;
    });
}
