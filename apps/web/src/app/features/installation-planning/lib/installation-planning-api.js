import { supaLite } from "../../../lib/supa-lite.js";

export async function fetchInstallationPlanningData(orgId) {
  const [projects, teams, plans, points, profiles] = await Promise.all([
    supaLite
      .from("projects")
      .select("id,org_id,name,code,status,start_date,end_date")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      ._execute(),
    supaLite
      .from("project_teams")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      ._execute(),
    supaLite
      .from("installation_plans")
      .select("*")
      .eq("org_id", orgId)
      .order("start_date", { ascending: true })
      ._execute(),
    supaLite
      .from("installation_points")
      .select("*")
      .eq("org_id", orgId)
      .order("assigned_date", { ascending: true })
      ._execute(),
    supaLite
      .from("profiles")
      .select("id,full_name,display_name,role,org_id")
      .eq("org_id", orgId)
      .order("full_name", { ascending: true })
      ._execute(),
  ]);

  const error =
    projects.error ?? teams.error ?? plans.error ?? points.error ?? profiles.error ?? null;

  return {
    data: {
      projects: projects.data ?? [],
      teams: teams.data ?? [],
      plans: plans.data ?? [],
      points: points.data ?? [],
      profiles: profiles.data ?? [],
    },
    error,
  };
}

export async function createProjectTeam(payload) {
  return supaLite.from("project_teams").insert(payload);
}

export async function createInstallationPlan(payload) {
  return supaLite.from("installation_plans").insert(payload);
}

export async function createInstallationPoint(payload) {
  return supaLite.from("installation_points").insert(payload);
}

export async function updateInstallationPoint(pointId, payload) {
  return supaLite.from("installation_points").update(payload).eq("id", pointId);
}

