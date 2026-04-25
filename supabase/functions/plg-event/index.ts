import { corsHeaders, json } from "../_shared/cors.ts";
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

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message ?? "event_capture_failed" }, { status: 500 });
  }
});
