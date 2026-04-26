type SalesAlertResult =
  | { sent: true; score: number; segment: string }
  | { sent: false; reason: string; score?: number; segment?: string };

const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000";

function optionalEnv(name: string) {
  return Deno.env.get(name) ?? "";
}

function numberEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function asNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function messageForLead(lead: Record<string, unknown>, triggerEvent: string) {
  const score = asNumber(lead.score);
  const signals = (lead.signals && typeof lead.signals === "object"
    ? lead.signals
    : {}) as Record<string, unknown>;
  const segment = String(lead.segment ?? "standard");
  const title = segment === "win_back" ? "🔁 BCM Win-back Lead" : "🔥 BCM Hot Lead Alert";
  const orgName = String(lead.org_name ?? "Unknown organization");
  const plan = String(lead.plan ?? "free").toUpperCase();
  const level = String(lead.level ?? "warm").toUpperCase();
  const status = String(lead.subscription_status ?? "inactive");

  return [
    title,
    `องค์กร: ${orgName}`,
    `PQL Score: ${score} (${level})`,
    `Plan: ${plan} / Status: ${status}`,
    `BIA: ${asNumber(signals.bia_processes)} | BCP: ${asNumber(signals.bc_plans)} | MAC: ${asNumber(signals.mac_triggers)}`,
    `Paid before: ${asNumber(signals.paid_before) ? "YES" : "NO"} | Win-back: ${asNumber(signals.win_back) ? "YES" : "NO"}`,
    `Trigger: ${triggerEvent}`,
    "Action: ทักทาย/เสนอ onboarding หรือแพ็กเกจที่เหมาะสม",
  ].join("\n");
}

export async function maybeSendSalesAlert({
  admin,
  orgId,
  triggerEvent,
}: {
  admin: any;
  orgId: string | null;
  triggerEvent: string;
}): Promise<SalesAlertResult> {
  if (!orgId || orgId === SYSTEM_ORG_ID) {
    return { sent: false, reason: "system_or_missing_org" };
  }

  const channelToken = optionalEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const to = optionalEnv("LINE_ALERT_TO");
  if (!channelToken || !to) {
    return { sent: false, reason: "line_not_configured" };
  }

  const { data: lead, error } = await admin.rpc("calculate_pql_score", { target_org_id: orgId });
  if (error || !lead) {
    return { sent: false, reason: error?.message ?? "score_unavailable" };
  }

  const score = asNumber(lead.score);
  const segment = String(lead.segment ?? "standard");
  const signals = (lead.signals && typeof lead.signals === "object"
    ? lead.signals
    : {}) as Record<string, unknown>;
  const minScore = numberEnv("SALES_ALERT_MIN_SCORE", 50);
  const isWinBack = segment === "win_back" || asNumber(signals.win_back) === 1;

  if (score < minScore && !isWinBack) {
    return { sent: false, reason: "below_threshold", score, segment };
  }

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { count: recentAlerts } = await admin
    .from("plg_events")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("event_name", "sales_alert_sent")
    .gte("created_at", since);

  if ((recentAlerts ?? 0) > 0) {
    return { sent: false, reason: "recent_alert_exists", score, segment };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${channelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: messageForLead(lead, triggerEvent) }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { sent: false, reason: `line_push_failed:${response.status}:${detail.slice(0, 160)}`, score, segment };
  }

  await admin.from("plg_events").insert({
    org_id: orgId,
    event_name: "sales_alert_sent",
    properties: {
      score,
      level: lead.level ?? null,
      segment,
      trigger_event: triggerEvent,
      channel: "line_messaging_api",
    },
  });

  return { sent: true, score, segment };
}
