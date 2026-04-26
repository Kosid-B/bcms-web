import { corsHeaders, json } from "../_shared/cors.ts";
import { maybeSendSalesAlert } from "../_shared/sales-alert.ts";
import { createAdminClient, getUserFromAuthHeader } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_name, properties = {} } = await req.json();
    if (!event_name) {
      return json({ error: "event_name_required" }, { status: 400 });
    }

    const user = await getUserFromAuthHeader(req.headers.get("Authorization"));
    const admin = createAdminClient();

    let orgId = null;
    if (user?.id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();
      orgId = profile?.org_id ?? null;
    }

    await admin.from("plg_events").insert({
      user_id: user?.id ?? null,
      org_id: orgId,
      event_name,
      properties,
    });

    let sales_alert = null;
    try {
      sales_alert = await maybeSendSalesAlert({ admin, orgId, triggerEvent: event_name });
    } catch (alertError) {
      console.warn("sales_alert_failed", alertError instanceof Error ? alertError.message : String(alertError));
      sales_alert = { sent: false, reason: "alert_failed" };
    }

    return json({ ok: true, sales_alert });
  } catch (error) {
    return json({ error: error.message ?? "event_capture_failed" }, { status: 500 });
  }
});
