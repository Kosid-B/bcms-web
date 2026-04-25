import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient, getUserFromAuthHeader } from "../_shared/supabase.ts";

const PLAN_PRICING: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 2900, annual: 2320 },
  professional: { monthly: 7900, annual: 6320 },
  enterprise: { monthly: 19900, annual: 15920 },
};

function buildAmount(plan: string, billing: string) {
  const price = PLAN_PRICING[plan];
  if (!price) return 0;
  const subtotal = billing === "annual" ? price.annual * 12 : price.monthly;
  return Math.round(subtotal * 1.07);
}

function buildOrderRef() {
  return `BCMS-${Date.now().toString(36).toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUserFromAuthHeader(req.headers.get("Authorization"));
    if (!user) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const { plan, billing = "monthly", slip_path, slip_name } = await req.json();
    if (!plan || !slip_path) {
      return json({ error: "plan_and_slip_required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return json({ error: "profile_not_ready" }, { status: 400 });
    }

    const orderRef = buildOrderRef();
    const amount = buildAmount(plan, billing);

    const { error } = await admin.from("payment_orders").insert({
      order_ref: orderRef,
      org_id: profile.org_id,
      created_by: user.id,
      plan,
      billing,
      amount_thb: amount,
      currency: "THB",
      status: "pending",
      slip_url: slip_path,
      slip_name: slip_name ?? null,
    });

    if (error) throw error;

    await admin.from("plg_events").insert({
      user_id: user.id,
      org_id: profile.org_id,
      event_name: "payment_submitted",
      properties: { order_ref: orderRef, plan, billing, amount_thb: amount },
    });

    return json({
      ok: true,
      order_ref: orderRef,
      status: "pending",
      message: "payment_submitted",
    });
  } catch (error) {
    return json({ error: error.message ?? "payment_failed" }, { status: 500 });
  }
});
