import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

type PqlLead = {
  org_id: string;
  org_name: string;
  plan: string;
  subscription_status: string;
  segment: "standard" | "win_back";
  score: number;
  level: "cold" | "warm" | "hot" | "sales_ready";
  last_seen: string | null;
  signals: Record<string, number>;
};

const PLAN_ARR_THB: Record<string, number> = {
  free: 0,
  starter: 990 * 12,
  professional: 2490 * 12,
  enterprise: 9900 * 12,
};

const FEATURE_LABELS: Record<string, string> = {
  bia_created: "BIA",
  bia_process_created: "BIA",
  mac_trigger_activated: "MAC",
  bc_plan_created: "BCP",
  plan_activated: "BCP",
  report_exported: "Export",
  bia_pdf_generated: "Export",
  payment_order_created: "Payment",
  subscription_activated: "Payment",
};

const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000";

function pct(part: number, total: number) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "scoring_failed";
}

function normalizeLead(value: unknown): PqlLead | null {
  if (!value || typeof value !== "object") return null;
  const lead = value as Record<string, unknown>;
  const orgId = String(lead.org_id ?? "");
  if (!orgId) return null;

  const level = String(lead.level ?? "cold") as PqlLead["level"];
  return {
    org_id: orgId,
    org_name: String(lead.org_name ?? "Unknown organization"),
    plan: String(lead.plan ?? "free"),
    subscription_status: String(lead.subscription_status ?? "inactive"),
    segment: String(lead.segment ?? "standard") === "win_back" ? "win_back" : "standard",
    score: Number(lead.score ?? 0),
    level,
    last_seen: lead.last_seen ? String(lead.last_seen) : null,
    signals: (lead.signals && typeof lead.signals === "object"
      ? lead.signals
      : {}) as Record<string, number>,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createAdminClient();

    const [
      orgsRes,
      subsRes,
      eventsRes,
      biaCountRes,
      orderCountRes,
      paidOrderCountRes,
      totalProfilesRes,
    ] = await Promise.all([
      admin
        .from("organizations")
        .select("id,name,created_at")
        .neq("id", SYSTEM_ORG_ID)
        .neq("name", "PLATFORM_CONFIG")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("subscriptions")
        .select("org_id,plan,status,updated_at,created_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false }),
      admin
        .from("plg_events")
        .select("org_id,event_name,created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      admin.from("bia_processes").select("org_id", { count: "exact", head: true }).is("deleted_at", null),
      admin.from("payment_orders").select("*", { count: "exact", head: true }),
      admin.from("payment_orders").select("*", { count: "exact", head: true }).in("status", ["confirmed", "paid"]),
      admin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    if (orgsRes.error) throw orgsRes.error;

    const orgs = orgsRes.data ?? [];
    const subscriptions = subsRes.data ?? [];
    const events = eventsRes.data ?? [];

    const scored = await Promise.all(
      orgs.map(async (org) => {
        const { data, error } = await admin.rpc("calculate_pql_score", { target_org_id: org.id });
        if (error) {
          console.warn("calculate_pql_score failed", org.id, error.message);
          return null;
        }
        return normalizeLead(data);
      }),
    );

    const allLeads = scored.filter((lead): lead is PqlLead => Boolean(lead));
    const leads = allLeads
      .filter((lead) =>
        lead.score >= 60
        || lead.level === "hot"
        || lead.level === "sales_ready"
        || (lead.signals?.win_back ?? 0) === 1
        || lead.segment === "win_back"
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    const latestSubscriptionByOrg = new Map<string, { plan: string; status: string }>();
    for (const sub of subscriptions) {
      const orgId = String(sub.org_id ?? "");
      if (!orgId) continue;
      if (!latestSubscriptionByOrg.has(orgId)) {
        latestSubscriptionByOrg.set(orgId, {
          plan: String(sub.plan ?? "free"),
          status: String(sub.status ?? "inactive"),
        });
      }
    }

    const planDistribution: Record<string, number> = { free: 0, starter: 0, professional: 0, enterprise: 0 };
    let arrThb = 0;
    let paid = 0;
    for (const org of orgs) {
      const sub = latestSubscriptionByOrg.get(String(org.id));
      const plan = sub?.plan ?? "free";
      const status = sub?.status ?? "inactive";
      planDistribution[plan] = (planDistribution[plan] ?? 0) + 1;
      if (status === "active" && plan !== "free") {
        paid += 1;
        arrThb += PLAN_ARR_THB[plan] ?? 0;
      }
    }

    const featureAdoption: Record<string, number> = {
      BIA: 0,
      BCP: 0,
      MAC: 0,
      Export: 0,
      Payment: 0,
    };
    const activeOrgs = new Set<string>();
    for (const event of events) {
      const orgId = String(event.org_id ?? "");
      if (orgId) activeOrgs.add(orgId);
      const label = FEATURE_LABELS[String(event.event_name ?? "")];
      if (label) featureAdoption[label] = (featureAdoption[label] ?? 0) + 1;
    }

    const onboarded = allLeads.filter((lead) => {
      const signals = lead.signals ?? {};
      return (signals.bia_processes ?? 0) > 0 || (signals.bc_plans ?? 0) > 0 || activeOrgs.has(lead.org_id);
    }).length;
    const winBack = allLeads.filter((lead) => (lead.signals?.win_back ?? 0) === 1 || lead.segment === "win_back").length;

    return json({
      leads,
      signups: totalProfilesRes.count ?? 0,
      orders: orderCountRes.count ?? 0,
      conversions: paidOrderCountRes.count ?? 0,
      conversion_rate: pct(paidOrderCountRes.count ?? 0, orderCountRes.count ?? 0),
      mrr_estimate: Math.round(arrThb / 12),
      funnel: {
        total_orgs: orgs.length,
        onboarded,
        paid,
        onboard_rate: pct(onboarded, orgs.length),
        cvr_pct: pct(paid, orgs.length),
      },
      metrics: {
        arr_thb: arrThb,
        plan_distribution: planDistribution,
        bia_processes: biaCountRes.count ?? 0,
        win_back,
      },
      feature_adoption: featureAdoption,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return json({ error: errorMessage(error) }, { status: 500 });
  }
});
