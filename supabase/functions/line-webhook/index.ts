import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const textEncoder = new TextEncoder();

type LineMessage = {
  type?: string;
  text?: string;
};

type LineSource = {
  userId?: string;
  groupId?: string;
};

type LineEvent = {
  type?: string;
  mode?: string;
  timestamp?: number;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery?: boolean;
  };
  source?: LineSource;
  message?: LineMessage;
};

type LinePayload = {
  events?: LineEvent[];
};

function getTextMessage(event: LineEvent) {
  if (event.message?.type !== "text") return "";
  return String(event.message.text ?? "").trim();
}

function buildDedupKey(event: LineEvent) {
  if (event.webhookEventId) return `line:${event.webhookEventId}`;
  const fallback = [
    event.type ?? "",
    event.mode ?? "",
    String(event.source?.userId ?? ""),
    String(event.source?.groupId ?? ""),
    String(event.timestamp ?? ""),
    getTextMessage(event),
  ].join("|");
  return `line-fallback:${fallback}`;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function signLineBody(body: string, channelSecret: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(body));
  return toBase64(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // LINE webhook uses POST, but allow GET for quick health checks.
  if (req.method === "GET") {
    return json({ ok: true, service: "line-webhook" }, { status: 200 });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
    if (channelSecret) {
      const expectedSignature = await signLineBody(rawBody, channelSecret);
      const receivedSignature = req.headers.get("x-line-signature") ?? "";
      if (!receivedSignature || !constantTimeEqual(receivedSignature, expectedSignature)) {
        return json({ ok: false, error: "invalid_signature" }, { status: 401 });
      }
    }

    const payload = (rawBody ? JSON.parse(rawBody) : {}) as LinePayload;
    const events = Array.isArray(payload.events) ? payload.events : [];
    let insertedCount = 0;
    let dedupedCount = 0;

    if (events.length > 0) {
      const admin = createAdminClient();
      const rows = events.map((event) => ({
        event_name: "line_webhook_received",
        properties: {
          dedup_key: buildDedupKey(event),
          webhook_event_id: String(event.webhookEventId ?? ""),
          is_redelivery: Boolean(event.deliveryContext?.isRedelivery ?? false),
          timestamp: event.timestamp ?? null,
          type: String(event.type ?? ""),
          mode: String(event.mode ?? ""),
          user_id: String(event.source?.userId ?? ""),
          group_id: String(event.source?.groupId ?? ""),
          text: getTextMessage(event),
        },
      }));

      const dedupKeys = rows.map((row) => String(row.properties.dedup_key)).filter(Boolean);
      const { data: existingRows, error: existingError } = await admin
        .from("plg_events")
        .select("properties")
        .eq("event_name", "line_webhook_received")
        .in("properties->>dedup_key", dedupKeys);

      if (existingError) {
        console.error("line_webhook_existing_query_error", existingError);
      }

      const existingKeys = new Set(
        (existingRows ?? [])
          .map((row: { properties?: { dedup_key?: string } }) => String(row.properties?.dedup_key ?? ""))
          .filter(Boolean),
      );

      const rowsToInsert = rows.filter((row) => !existingKeys.has(String(row.properties.dedup_key)));
      dedupedCount = rows.length - rowsToInsert.length;

      if (rowsToInsert.length > 0) {
        const { error } = await admin.from("plg_events").insert(rowsToInsert);
        if (error) {
          console.error("line_webhook_bulk_insert_error", error);
        } else {
          insertedCount = rowsToInsert.length;
        }
      }
    }

    // LINE requires HTTP 200 when webhook is received successfully.
    return json({ ok: true, received: events.length, inserted: insertedCount, deduped: dedupedCount }, { status: 200 });
  } catch (error) {
    console.error("line_webhook_error", error);
    // Return 200 to avoid repeated retries from LINE platform on non-critical failures.
    return json({ ok: true, received: 0 }, { status: 200 });
  }
});
