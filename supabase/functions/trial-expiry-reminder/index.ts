import { corsHeaders, json } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { requiredEnv } from "../_shared/env.ts";

type Candidate = {
  org_id: string;
  org_name: string;
  trial_ends_at: string;
  recipient_email: string;
  days_left: number;
};

function getBodyHtml(orgName: string, trialEndsAt: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px 0">แจ้งเตือนทดลองใช้ฟรีใกล้หมดอายุ</h2>
      <p>องค์กร <strong>${orgName}</strong> ของคุณจะหมดสิทธิ์ทดลองใช้ฟรีในอีก <strong>3 วัน</strong></p>
      <p>วันหมดอายุ: <strong>${new Date(trialEndsAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</strong></p>
      <p>เพื่อใช้งานต่อเนื่อง กรุณาเลือกแพ็กเกจในระบบก่อนหมดอายุ</p>
      <p style="margin-top:16px">เข้าใช้งาน: <a href="https://bcms.theossphere.com">https://bcms.theossphere.com</a></p>
    </div>
  `;
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resend_failed: ${res.status} ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cronSecret = requiredEnv("TRIAL_REMINDER_CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return json({ error: "unauthorized" }, { status: 401 });
    }

    const resendKey = requiredEnv("RESEND_API_KEY");
    const fromEmail = requiredEnv("TRIAL_REMINDER_FROM_EMAIL");

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_trial_expiry_candidates", { p_days_before: 3 });
    if (error) throw error;

    const candidates = (data ?? []) as Candidate[];

    let sent = 0;
    let failed = 0;
    const failures: Array<{ org_id: string; email: string; error: string }> = [];

    for (const row of candidates) {
      try {
        await sendViaResend(
          resendKey,
          fromEmail,
          row.recipient_email,
          "แจ้งเตือน: ทดลองใช้ฟรีจะหมดอายุใน 3 วัน",
          getBodyHtml(row.org_name, row.trial_ends_at),
        );

        const { error: markError } = await admin.rpc("mark_trial_expiry_email_sent", {
          p_org_id: row.org_id,
          p_trial_ends_at: row.trial_ends_at,
          p_recipient_email: row.recipient_email,
          p_provider: "resend",
        });
        if (markError) throw markError;
        sent += 1;
      } catch (err) {
        failed += 1;
        failures.push({
          org_id: row.org_id,
          email: row.recipient_email,
          error: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }

    return json({
      ok: true,
      total_candidates: candidates.length,
      sent,
      failed,
      failures,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unexpected_error",
      },
      { status: 500 },
    );
  }
});
