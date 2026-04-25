import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createAdminClient();

    const [{ count: totalOrders }, { count: paidOrders }, { count: totalProfiles }] = await Promise.all([
      admin.from("payment_orders").select("*", { count: "exact", head: true }),
      admin.from("payment_orders").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
      admin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    return json({
      leads: [],
      signups: totalProfiles ?? 0,
      orders: totalOrders ?? 0,
      conversions: paidOrders ?? 0,
      conversion_rate: totalOrders ? Number(((paidOrders ?? 0) / totalOrders * 100).toFixed(2)) : 0,
      mrr_estimate: 0,
    });
  } catch (error) {
    return json({ error: error.message ?? "scoring_failed" }, { status: 500 });
  }
});
