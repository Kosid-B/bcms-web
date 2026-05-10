import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      return json(
        {
          ok: false,
          service: "health",
          db: "down",
          error: error.message,
        },
        { status: 500 },
      );
    }

    return json(
      {
        ok: true,
        service: "health",
        db: "up",
        organizations: count ?? 0,
        ts: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    return json(
      {
        ok: false,
        service: "health",
        db: "down",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
});
