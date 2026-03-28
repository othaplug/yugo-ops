import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();
  const base = getEmailBaseUrl();
  const now = Date.now();
  const fifteenMinAgo = new Date(now - 15 * 60_000).toISOString();
  const oneDayAgo = new Date(now - 24 * 3600_000).toISOString();

  const { data: stale15 } = await sb
    .from("leads")
    .select("id, lead_number, first_name, service_type, created_at, stale_escalation_sent_at")
    .in("status", ["new", "assigned"])
    .is("first_response_at", null)
    .is("follow_up_sent_at", null)
    .lt("created_at", fifteenMinAgo)
    .is("stale_escalation_sent_at", null);

  const { data: admins } = await sb
    .from("platform_users")
    .select("user_id, phone, email")
    .in("role", ["owner", "admin", "manager", "coordinator"]);

  let escalated = 0;
  for (const lead of stale15 || []) {
    const mins = Math.floor((now - new Date(lead.created_at as string).getTime()) / 60_000);
    const name = (lead.first_name as string) || "Unknown";
    const svc = (lead.service_type as string) || "Move";
    const url = `${base}/admin/leads/${lead.id}`;
    const line = `STALE LEAD (${mins} min): ${name} — ${svc}. Nobody has responded. ${url}`;

    for (const a of admins || []) {
      const p = a.phone as string | null;
      if (p && p.replace(/\D/g, "").length >= 10) {
        await sendSMS(p, line).catch(() => {});
      }
    }

    await sb
      .from("leads")
      .update({ stale_escalation_sent_at: new Date().toISOString() })
      .eq("id", lead.id as string);
    escalated++;
  }

  const { error: staleErr } = await sb
    .from("leads")
    .update({ status: "stale" })
    .in("status", ["new", "assigned"])
    .is("first_response_at", null)
    .is("follow_up_sent_at", null)
    .lt("created_at", oneDayAgo);

  return NextResponse.json({
    ok: true,
    escalated,
    marked_stale_error: staleErr?.message ?? null,
  });
}
