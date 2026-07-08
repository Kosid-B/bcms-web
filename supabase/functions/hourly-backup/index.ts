/**
 * hourly-backup — ISO 22301 §8.3 Recovery Strategy
 *
 * Exports each org's BCMS data as JSONL to Supabase Storage.
 * Invoke via pg_cron every hour:
 *   select cron.schedule('hourly-backup', '0 * * * *',
 *     $$select net.http_post(url := '<YOUR_FUNCTION_URL>/hourly-backup',
 *       headers := '{"Authorization":"Bearer <SERVICE_KEY>"}'::jsonb)$$);
 *
 * Or call from Supabase Dashboard → Edge Functions → hourly-backup → Trigger.
 */

import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const TABLES = [
  "bia_processes",
  "bc_plans",
  "exercises",
  "capa_items",
  "risk_items",
  "profiles",
] as const;

const BUCKET = "org-backups";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createAdminClient();

    // List all orgs
    const { data: orgs, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .is("deleted_at", null);

    if (orgErr) throw orgErr;
    if (!orgs?.length) return json({ ok: true, orgs: 0, message: "no orgs" });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const results: Array<{ org_id: string; ok: boolean; tables: string[]; error?: string }> = [];

    for (const org of orgs) {
      const chunks: string[] = [];
      const successTables: string[] = [];

      for (const table of TABLES) {
        const { data, error } = await supabase
          .from(table as string)
          .select("*")
          .eq("org_id", org.id);

        if (error) {
          // Table may not have org_id — skip silently
          continue;
        }

        if (data && data.length > 0) {
          // JSONL: one JSON object per line
          const lines = data.map((row) => JSON.stringify({ _table: table, ...row })).join("\n");
          chunks.push(lines);
          successTables.push(table);
        }
      }

      if (chunks.length === 0) {
        results.push({ org_id: org.id, ok: true, tables: [] });
        continue;
      }

      const content = chunks.join("\n") + "\n";
      const path = `${org.id}/${timestamp}.jsonl`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([content], { type: "application/x-ndjson" }), {
          upsert: true,
          contentType: "application/x-ndjson",
        });

      if (uploadErr) {
        results.push({ org_id: org.id, ok: false, tables: [], error: uploadErr.message });
        continue;
      }

      // Prune files older than 7 days for this org
      try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace(/[:.]/g, "-");
        const { data: existing } = await supabase.storage.from(BUCKET).list(org.id, { limit: 200 });
        const old = (existing ?? []).filter((f) => f.name < cutoff);
        if (old.length > 0) {
          await supabase.storage.from(BUCKET).remove(old.map((f) => `${org.id}/${f.name}`));
        }
      } catch (_) { /* prune failure is non-fatal */ }

      results.push({ org_id: org.id, ok: true, tables: successTables });
    }

    const failed = results.filter((r) => !r.ok).length;
    return json({ ok: failed === 0, orgs: orgs.length, results, timestamp });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
