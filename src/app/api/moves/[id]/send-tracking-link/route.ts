import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { trackingLinkEmail } from "@/lib/email-templates";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getMoveCode } from "@/lib/move-code";
import { requireStaff } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: move } = await supabase
      .from("moves")
      .select("id, client_name, client_email, estimate")
      .eq("id", id)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const email = (move.client_email || "").trim().toLowerCase();
    const name = (move.client_name || "").trim();
    if (!email) return NextResponse.json({ error: "Add client email first" }, { status: 400 });

    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_api_key_here") {
      return NextResponse.json({ error: "Email not configured" }, { status: 503 });
    }

    const trackUrl = `${getEmailBaseUrl()}/track/move/${move.id}?token=${signTrackToken("move", move.id)}`;
    const moveCode = getMoveCode(move);

    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: email,
      subject: `Track your move — ${moveCode}`,
      html: trackingLinkEmail({
        clientName: name || "there",
        trackUrl,
        moveNumber: moveCode,
      }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });

    if (sendError) {
      const msg = typeof sendError === "object" && sendError !== null && "message" in sendError
        ? String((sendError as { message?: string }).message)
        : String(sendError);
      return NextResponse.json({ error: msg || "Email failed to send" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send tracking link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
