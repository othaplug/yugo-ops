import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWalkthroughToken } from "@/lib/track-token";
import { getAdminNotificationEmail } from "@/lib/config";
import { getEmailFrom } from "@/lib/email/send";
import { getResend } from "@/lib/resend";

// ─────────────────────────────────────────────────────────────
// POST /api/walkthrough/[token]/confirm
// Public — client confirms the remote walkthrough.
// ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const moveId = verifyWalkthroughToken(token);
  if (!moveId) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* body optional */ }

  const confirmed = body.confirmed === true;
  if (!confirmed) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code, client_name, walkthrough_remote_confirmed")
    .eq("id", moveId)
    .maybeSingle();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (move.walkthrough_remote_confirmed) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  await admin
    .from("moves")
    .update({
      walkthrough_remote_confirmed: true,
      walkthrough_remote_confirmed_at: new Date().toISOString(),
      walkthrough_completed: true,
      walkthrough_completed_at: new Date().toISOString(),
    })
    .eq("id", moveId);

  // Notify coordinator that the client has confirmed remotely
  try {
    const resend = getResend();
    const from = await getEmailFrom();
    const adminEmail = await getAdminNotificationEmail();
    if (adminEmail) {
      const firstName = (move.client_name as string | null)?.split(" ")[0] ?? "Client";
      const moveCode = move.move_code ? `#${move.move_code}` : moveId.slice(0, 8);
      await resend.emails.send({
        from,
        to: adminEmail,
        subject: `Remote walkthrough confirmed by ${firstName} (${moveCode})`,
        html: `<p>${firstName} has confirmed the remote walkthrough for move ${moveCode}. The crew may proceed.</p>`,
      });
    }
  } catch (err) {
    console.error("[WalkthroughConfirm] admin notification error:", err);
  }

  return NextResponse.json({ ok: true });
}
