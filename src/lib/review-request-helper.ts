import { SupabaseClient } from "@supabase/supabase-js";
import { backfillMoveClientEmailFromQuote } from "@/lib/client-referral";
import { isReviewOptedOut } from "@/lib/review/opt-out";
import { sendEmail } from "@/lib/email/send";
import { internalLowSatAlertEmail } from "@/lib/email/lifecycle-templates";

// Unified cadence, measured from move completion (or claim resolution for a
// held request). No star gate: every ask links straight to Google.
//   Touch 1  ~3h     SMS
//   Touch 2  ~72h    SMS AND email
//   Touch 3  ~day 6  email, then stop
// The cadence stops the moment the client clicks the Google link, replies, or
// opts out. A client with an OPEN damage claim is HELD (not skipped): the row
// is created with status "held" and the cron starts the cadence once the claim
// is resolved, clocked from the resolution.
const TOUCH_1_MS = 3 * 60 * 60 * 1000; //  ~3 hours: crew gone, client settled
const TOUCH_2_MS = 3 * 24 * 60 * 60 * 1000; //  72 hours: SMS + email
const TOUCH_3_MS = 6 * 24 * 60 * 60 * 1000; //  day 6: final email, then stop

/** Short, unambiguous code (no l/1/o/0) for the /r/<code> review SMS link. */
function genReviewShortCode(len = 7): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/**
 * Create the single review-orchestration row for a completed move. One row per
 * move drives all three touches. We ask every completed move (with or without a
 * post-move checklist, any rating) as long as it has a way to reach the client;
 * the star tap gates who reaches Google. Excluded only when: the feature is off,
 * an open damage claim exists, or the client permanently opted out.
 */
export async function createReviewRequestIfEligible(
  supabase: SupabaseClient,
  moveId: string
): Promise<boolean> {
  const { data: config } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "auto_review_requests")
    .single();
  if (config?.value !== "true" && config?.value !== "1") return false;

  const { data: move } = await supabase
    .from("moves")
    .select("id, move_code, client_name, client_email, client_phone, tier_selected, status, completed_at, scheduled_date")
    .eq("id", moveId)
    .single();
  if (!move || move.status !== "completed") return false;

  // A client with an OPEN damage claim is HELD, not skipped. We still create the
  // request so it isn't lost, but with status "held" and no send times; the cron
  // starts the cadence once the claim resolves (clocked from the resolution). An
  // unresolved claim reads badly and invites a public 1-star, so we never ask
  // mid-claim — but a client whose issue we fix should still be asked.
  const { data: openClaims } = await supabase
    .from("claims")
    .select("id, status")
    .eq("move_id", moveId);
  const hasOpenClaim = (openClaims ?? []).some((c) => {
    const s = String((c as { status?: string | null }).status ?? "").toLowerCase().trim();
    return s !== "resolved" && s !== "closed" && s !== "denied" && s !== "cancelled";
  });

  const { data: existing } = await supabase
    .from("review_requests")
    .select("id")
    .eq("move_id", moveId)
    .maybeSingle();
  if (existing) return false;

  // Store the checklist rating for the record + immediate low-satisfaction
  // handling, but do NOT gate on it — an unhappy checklist still gets the ask,
  // and the tap re-gates them away from Google.
  let podRating: number | null = null;
  const { data: pod } = await supabase
    .from("proof_of_delivery")
    .select("satisfaction_rating")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pod?.satisfaction_rating != null) podRating = Number(pod.satisfaction_rating);

  // "Find something for them": a 1-3 post-move checklist rating alerts an admin
  // immediately so a coordinator can reach out, independent of whether we go on
  // to send the review ask. Fires once (guarded above by the existing-row check).
  if (podRating != null && podRating >= 1 && podRating <= 3) {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `Low checklist ${podRating} star: ${move.client_name || "client"} ${move.move_code || ""}, reach out`,
        html: internalLowSatAlertEmail({
          clientName: move.client_name || "",
          clientEmail: move.client_email || "",
          clientPhone: move.client_phone || "",
          moveCode: move.move_code || moveId,
          npsScore: podRating,
          moveDate: move.scheduled_date ?? null,
        }),
      }).catch(() => {});
    }
  }

  // Backfill email from quote→contact so SMS-less clients still get an email touch.
  const backfilled = await backfillMoveClientEmailFromQuote(supabase, moveId);
  const clientEmail = (move.client_email || "").trim() || backfilled.email || null;
  const clientPhone = (move.client_phone || "").trim() || null;
  const clientName = (move.client_name || "").trim() || backfilled.name || "Client";

  // Need at least one channel to reach the client.
  if (!clientEmail && !clientPhone) return false;

  // Permanent opt-out is honoured across every future job.
  if (await isReviewOptedOut(supabase, { email: clientEmail, phone: clientPhone })) {
    return false;
  }

  const completedAt = move.completed_at ? new Date(move.completed_at) : new Date();
  const t = completedAt.getTime();

  // Held requests (open claim) carry no send times; the cron fills them in and
  // flips the row to "pending" once the claim is resolved.
  const { error } = await supabase.from("review_requests").insert({
    move_id: moveId,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    tier: move.tier_selected || null,
    pod_rating: podRating,
    short_code: genReviewShortCode(),
    scheduled_send_at: hasOpenClaim ? null : new Date(t + TOUCH_1_MS).toISOString(),
    reminder_send_at: hasOpenClaim ? null : new Date(t + TOUCH_2_MS).toISOString(),
    final_send_at: hasOpenClaim ? null : new Date(t + TOUCH_3_MS).toISOString(),
    status: hasOpenClaim ? "held" : "pending",
  });

  return !error;
}
