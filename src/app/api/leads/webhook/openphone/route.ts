import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLeadPipeline } from "@/lib/leads/inbound";
import { sendMissedCallSms } from "@/lib/leads/acknowledgment";

export const dynamic = "force-dynamic";

function verify(req: NextRequest): boolean {
  const secret = process.env.OPENPHONE_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return bearer === secret;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function POST(req: NextRequest) {
  if (!verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = asRecord(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = String(body.type || body.event || "").toLowerCase();
  const data = asRecord(body.data ?? body.object ?? body);

  const direction = String(data.direction || "").toLowerCase();
  const status = String(data.status || data.call_status || data.state || "").toLowerCase();
  const fromRaw =
    (data.from as string) ||
    (data.from_number as string) ||
    (data.caller as string) ||
    (data.phone_number as string) ||
    "";

  const isMissed =
    status === "missed" ||
    status === "no_answer" ||
    status === "busy" ||
    status === "canceled" ||
    status === "cancelled";
  const isVoicemail = status === "voicemail" || status === "completed_voicemail";

  const shouldCreate =
    (eventType.includes("call") || eventType.includes("completed") || Object.keys(data).length > 0) &&
    direction === "inbound" &&
    (isMissed || isVoicemail);

  if (!shouldCreate || !fromRaw.replace(/\D/g, "").match(/\d{10}/)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const voicemailText =
    String(data.voicemail_transcript || data.transcription || data.voicemail_text || "") ||
    (isVoicemail ? "Voicemail received" : "Missed call — no voicemail");

  try {
    const sb = createAdminClient();
    const lead = await createLeadPipeline(sb, {
      phone: fromRaw,
      source: "phone_call",
      source_detail: isVoicemail ? "Voicemail" : "Missed call",
      message: voicemailText,
      send_acknowledgment: false,
    });

    await sendMissedCallSms(fromRaw);

    return NextResponse.json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error("[openphone leads webhook]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
