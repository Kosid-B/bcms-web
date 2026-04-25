import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient, getUserFromAuthHeader } from "../_shared/supabase.ts";

const PLAN_FEATURES: Record<string, { maxSeats: number; features: Record<string, boolean> }> = {
  free: {
    maxSeats: 3,
    features: { api: false, branding: false, white_label: false },
  },
  starter: {
    maxSeats: 10,
    features: { api: false, branding: false, white_label: false },
  },
  professional: {
    maxSeats: 50,
    features: { api: true, branding: false, white_label: false },
  },
  enterprise: {
    maxSeats: 250,
    features: { api: true, branding: true, white_label: true },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUserFromAuthHeader(req.headers.get("Authorization"));
    if (!user) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const { order_id, action = "confirm", reason = null } = await req.json();
    if (!order_id) {
      return json({ error: "order_id_required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single();

    if (actorError || !actor) {
      return json({ error: "actor_profile_not_found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(actor.role ?? "")) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return json({ error: "order_not_found" }, { status: 404 });
    }

    if (action === "reject") {
      const { error } = await admin
        .from("payment_orders")
        .update({
          status: "rejected",
          review_reason: reason ?? "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", order_id);

      if (error) throw error;

      return json({ ok: true, status: "rejected" });
    }

    const planConfig = PLAN_FEATURES[order.plan] ?? PLAN_FEATURES.free;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (order.billing === "annual" ? 12 : 1));

    const { error: subError } = await admin.from("subscriptions").upsert({
      org_id: order.org_id,
      plan: order.plan,
      status: "active",
      billing: order.billing,
      amount_thb: order.amount_thb,
      currency: order.currency ?? "THB",
      started_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: null,
    }, { onConflict: "org_id" });

    if (subError) throw subError;

    const { error: orgError } = await admin
      .from("organizations")
      .update({
        plan: order.plan,
        status: "active",
        max_seats: planConfig.maxSeats,
        features: planConfig.features,
      })
      .eq("id", order.org_id);

    if (orgError) throw orgError;

    const { error: paymentError } = await admin
      .from("payment_orders")
      .update({
        status: "confirmed",
        review_reason: null,
        reviewed_at: now.toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", order_id);

    if (paymentError) throw paymentError;

    await admin.from("plg_events").insert({
      user_id: user.id,
      org_id: order.org_id,
      event_name: "subscription_activated",
      properties: { plan: order.plan, billing: order.billing, order_id },
    });

    return json({
      ok: true,
      status: "confirmed",
      plan: order.plan,
      billing: order.billing,
      current_period_end: periodEnd.toISOString(),
    });
  } catch (error) {
    return json({ error: error.message ?? "subscription_activation_failed" }, { status: 500 });
  }
});
