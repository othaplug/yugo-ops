import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

/**
 * Daily: Estate moves that completed ~30 days ago receive a concierge check-in.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 40);

  const { data: moves, error } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, tier_selected, welcome_package_token, coordinator_name, coordinator_phone, coordinator_email, completed_at, estate_30day_checkin_sent_at, status",
    )
    .eq("tier_selected", "estate")
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .is("estate_30day_checkin_sent_at", null)
    .not("client_email", "is", null)
    .gte("completed_at", since.toISOString());

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  let sent = 0;
  const errors: string[] = [];

  const MS_DAY = 86_400_000;

  for (const move of moves ?? []) {
    if (!move.client_email) continue;
    const completed = move.completed_at
      ? new Date(move.completed_at).getTime()
      : 0;
    if (!completed) continue;
    const days = Math.floor((now.getTime() - completed) / MS_DAY);
    /** First eligible day is 30; allow catch-up if a cron run was missed (up to ~10 days). */
    if (days < 30 || days > 40) continue;

    const token = signTrackToken("move", move.id);
    const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${token}`;
    const wp = String(move.welcome_package_token ?? "").trim();
    const welcomeGuideUrl = wp ? `${baseUrl}/estate/welcome/${wp}` : null;

    try {
      const result = await sendEmail({
        to: move.client_email,
        subject: `How is everything settling in? ${move.move_code || ""}`.trim(),
        template: "estate-30day-checkin",
        data: {
          clientName: move.client_name || "",
          moveCode: move.move_code || move.id,
          trackingUrl,
          welcomeGuideUrl,
          coordinatorName: move.coordinator_name ?? null,
          coordinatorPhone: move.coordinator_phone ?? null,
          coordinatorEmail: move.coordinator_email ?? null,
        },
      });

      if (result.success) {
        await supabase
          .from("moves")
          .update({ estate_30day_checkin_sent_at: new Date().toISOString() })
          .eq("id", move.id);
        sent++;
      } else {
        errors.push(`${move.move_code}:${result.error}`);
      }
    } catch (e) {
      errors.push(
        `${move.move_code}:${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: moves?.length ?? 0,
    sent,
    errors: errors.length,
    errorDetail: errors.slice(0, 5),
  });
}
