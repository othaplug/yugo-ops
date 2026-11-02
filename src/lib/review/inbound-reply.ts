import { SupabaseClient } from "@supabase/supabase-js";
import { normalizeReviewPhone, recordReviewOptOut } from "@/lib/review/opt-out";
import { notifyAllAdmins } from "@/lib/notifications";

/** Statuses where the cadence is still live and a reply should stop it. */
const ACTIVE_STATUSES = ["pending", "sent", "reminded", "final", "held"];

/** Carrier STOP keywords — a reply of just one of these is a permanent opt-out. */
const STOP_WORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "stopp",
]);

type ReplyInput = { fromPhone: string; text: string };
type ReplyResult = { matched: boolean; reviewRequestId?: string; optedOut?: boolean };

/**
 * An inbound SMS from a client with a live review request stops their cadence
 * (the same stop signal as a link click) and routes what they wrote to every
 * coordinator in-app. The reply is our private feedback channel: a client who
 * had a problem replies to the text instead of posting it publicly on Google.
 *
 * Matching is by phone (digits-only, last 10) against active rows, newest first,
 * so a reply lands on the client's most recent move. A bare STOP/UNSUBSCRIBE is
 * also a permanent opt-out, honoured across every future job.
 *
 * Returns { matched:false } for any inbound message with no live review request
 * (an ordinary text to our line), so the caller can fall through to its own
 * handling untouched.
 */
export async function handleInboundReviewReply(
  admin: SupabaseClient,
  input: ReplyInput,
): Promise<ReplyResult> {
  const digits = normalizeReviewPhone(input.fromPhone);
  if (!digits) return { matched: false };
  const last10 = digits.slice(-10);

  // Pull the live review rows that have a phone and haven't been acted on, then
  // match on the last 10 digits in JS (phones are stored in mixed formats).
  const { data: rows } = await admin
    .from("review_requests")
    .select("id, move_id, client_name, client_phone, status, review_clicked")
    .in("status", ACTIVE_STATUSES)
    .eq("review_clicked", false)
    .not("client_phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  const match = (rows ?? []).find(
    (r) => (normalizeReviewPhone(r.client_phone) ?? "").slice(-10) === last10 && last10.length === 10,
  );
  if (!match) return { matched: false };

  const body = (input.text || "").trim();
  const isStop = STOP_WORDS.has(body.toLowerCase().replace(/[^a-z]/g, ""));

  // Stop the cadence: a reply is a terminal action, same as a click. We mark
  // review_clicked so the cron's existing stop check catches it too, and store
  // the reply for the coordinator.
  await admin
    .from("review_requests")
    .update({
      status: "done",
      review_clicked: true,
      review_clicked_at: new Date().toISOString(),
      review_replied_at: new Date().toISOString(),
      review_reply_text: body || null,
    })
    .eq("id", match.id);

  // A bare STOP is also a permanent opt-out (carrier compliance + their wish).
  if (isStop) {
    await recordReviewOptOut(admin, {
      phone: match.client_phone,
      reason: "SMS STOP reply to review request",
    });
  }

  // Route the reply to every coordinator in-app, linked to the move. This is
  // how a private concern reaches us instead of going to Google.
  let link: string | undefined;
  if (match.move_id) {
    const { data: mv } = await admin
      .from("moves")
      .select("move_code")
      .eq("id", match.move_id)
      .maybeSingle();
    if (mv?.move_code) link = `/admin/moves/${mv.move_code}`;
  }
  const who = (match.client_name || "A client").trim();
  try {
    await notifyAllAdmins({
      title: isStop
        ? `${who} opted out of review texts`
        : `${who} replied to the review request`,
      body: body ? `"${body}"` : "(no message body)",
      icon: "chat",
      link,
      eventSlug: "review_reply",
      sourceType: "move",
      sourceId: match.move_id || undefined,
    });
  } catch {
    /* alerting is best-effort */
  }

  return { matched: true, reviewRequestId: match.id, optedOut: isStop };
}
