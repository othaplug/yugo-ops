import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: moveId } = await params;
    const token = req.nextUrl.searchParams.get("token") || "";

    if (!verifyTrackToken("move", moveId, token)) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    const { phone, enabled } = await req.json();

    const db = createAdminClient();

    const update: Record<string, unknown> = {};
    if (typeof enabled === "boolean") update.client_sms_opt_in = enabled;
    if (typeof phone === "string" && phone.trim()) update.client_phone = phone.trim();

    if (Object.keys(update).length > 0) {
      const { error } = await db.from("moves").update(update).eq("id", moveId);
      if (error) {
        // Gracefully handle missing columns (e.g. client_sms_opt_in doesn't exist yet)
        console.warn("sms-preference update warning:", error.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("sms-preference error:", err);
    return NextResponse.json({ ok: true });
  }
}
