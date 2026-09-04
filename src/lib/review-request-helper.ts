import { SupabaseClient } from "@supabase/supabase-js";
import { backfillMoveClientEmailFromQuote } from "@/lib/client-referral";
import { isReviewOptedOut } from "@/lib/review/opt-out";
import { sendEmail } from "@/lib/email/send";
import { internalLowSatAlertEmail } from "@/lib/email/lifecycle-templates";

// Unified cadence, measured from move completion. Touch 1 is an SMS (or email
// when there is no phone); touches 2 and 3 are emails. The public star tap is
// the gate, so we ask EVERY completed move regardless of the checklist rating.
const TOUCH_1_MS = 3 * 60 * 60 * 1000; //  ~3 hours: crew gone, client settled
const TOUCH_2_MS = 3 * 24 * 60 * 60 * 1000; //  day 3: email, new framing
const TOUCH_3_MS = 6 * 24 * 60 * 60 * 1000; //  day 6: final email, then stop

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

  // Guard: never ask a client with an OPEN damage claim to review us. A resolved
  // claim is fine; an unresolved one reads badly and invites a public 1-star.
  const { data: openClaims } = await supabase
    .from("claims")
    .select("id, status")
    .eq("move_id", moveId);
  const hasOpenClaim = (openClaims ?? []).some((c) => {
    const s = String((c as { status?: string | null }).status ?? "").toLowerCase().trim();
    return s !== "resolved" && s !== "closed" && s !== "denied" && s !== "cancelled";
  });
  if (hasOpenClaim) return false;

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
        subject: `Low checklist ${podRating}★: ${move.client_name || "client"} ${move.move_code || ""} — reach out`,
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

  const { error } = await supabase.from("review_requests").insert({
    move_id: moveId,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    tier: move.tier_selected || null,
    pod_rating: podRating,
    scheduled_send_at: new Date(t + TOUCH_1_MS).toISOString(),
    reminder_send_at: new Date(t + TOUCH_2_MS).toISOString(),
    final_send_at: new Date(t + TOUCH_3_MS).toISOString(),
    status: "pending",
  });

  return !error;
}
