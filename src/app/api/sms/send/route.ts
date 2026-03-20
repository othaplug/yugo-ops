import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const enabled = (await getConfig("sms_enabled", "true")).toLowerCase() === "true";
  if (!enabled) {
    return NextResponse.json({ ok: false, skipped: "sms_disabled" });
  }

  const body = await req.json();
  const { to, message, type, related_id, related_type, recipient_name } = body;

  if (!to || !message) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  const result = await sendSMS(String(to), String(message));

  // Log to sms_log regardless of success
  try {
    const admin = createAdminClient();
    await admin.from("sms_log").insert({
      recipient_phone: String(to),
      recipient_name: recipient_name ? String(recipient_name) : null,
      message_body: String(message),
      message_type: type || "manual",
      related_id: related_id || null,
      related_type: related_type || null,
      twilio_sid: result.id || null,
      status: result.success ? "sent" : "failed",
    });
  } catch {
    // Non-critical
  }

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
