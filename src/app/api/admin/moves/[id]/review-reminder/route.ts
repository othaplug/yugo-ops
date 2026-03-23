import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getTrackMoveSlug } from "@/lib/move-code";
import { signTrackToken, signReviewToken } from "@/lib/track-token";

/**
 * POST: Send review request (when pending) or reminder (when sent).
 * - action=send: send first review email, set status to "sent" (only when status is "pending").
 * - action=remind (default): send reminder email, set status to "reminded" (only when status is "sent").
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = (body.action ?? "remind") === "send" ? "send" : "remind";

  const admin = createAdminClient();
  const baseUrl = getEmailBaseUrl();

  const { data: rr, error: rrErr } = await admin
    .from("review_requests")
    .select("*")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rrErr || !rr) {
    return NextResponse.json({ error: "No review request found for this move" }, { status: 404 });
  }

  if (rr.review_clicked) {
    return NextResponse.json(
      { error: "Client already clicked the review link" },
      { status: 400 }
    );
  }

  if (action === "send") {
    if (rr.status !== "pending") {
      return NextResponse.json(
        { error: "Initial request already sent; use Remind to send a reminder" },
        { status: 400 }
      );
    }
    const { data: move } = rr.move_id
      ? await admin.from("moves").select("move_code, id, client_email, client_name, quote_id").eq("id", rr.move_id).single()
      : { data: null };
    let clientEmail = (rr.client_email || move?.client_email || "").trim();
    let displayName = rr.client_name || move?.client_name || "Client";
    if (!clientEmail && move?.quote_id) {
      const { data: quote } = await admin.from("quotes").select("contact_id").eq("id", move.quote_id).single();
      if (quote?.contact_id) {
        const { data: contact } = await admin.from("contacts").select("email, name").eq("id", quote.contact_id).single();
        if (contact?.email) {
          clientEmail = (contact.email || "").trim();
          if (contact.name) displayName = contact.name;
        }
      }
    }
    if (!clientEmail) {
      return NextResponse.json(
        { error: "No client email on review request, move, or quote contact. Save the client's email in Client contact details first." },
        { status: 400 }
      );
    }
    if (!rr.client_email) {
      await admin
        .from("review_requests")
        .update({ client_email: clientEmail, client_name: displayName })
        .eq("id", rr.id);
    }
    const token = signReviewToken(rr.id);
    const reviewUrl = `${baseUrl}/review?token=${encodeURIComponent(token)}`;
    const reviewRedirectUrl = `${baseUrl}/api/review/redirect?token=${encodeURIComponent(token)}`;
    const tier = (rr.tier || "essential").toLowerCase();
    const trackSlug = move ? getTrackMoveSlug({ move_code: move.move_code, id: move.id }) : rr.move_id;
    const trackToken = rr.move_id ? signTrackToken("move", rr.move_id) : "";
    const trackingUrl = trackSlug ? `${baseUrl}/track/move/${trackSlug}?token=${trackToken}` : baseUrl;
    const template =
      tier === "estate"
        ? "review-request-estate"
        : tier === "signature" || tier === "premier"
          ? "review-request-signature"
          : "review-request-essential";
    const firstName = (displayName || "").trim().split(/\s+/)[0] || "";

    const { data: configRows } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", ["coordinator_name"]);
    const coordinatorName =
      (configRows || []).find((r) => r.key === "coordinator_name")?.value ?? null;

    const subject =
      tier === "estate"
        ? `${firstName}, it was our privilege how did we do?`
        : tier === "signature" || tier === "premier"
          ? `We'd love your feedback, ${firstName}`
          : `How was your Yugo move, ${firstName}?`;

    try {
      await sendEmail({
        to: clientEmail,
        subject,
        template,
        data: {
          clientName: displayName,
          tier: rr.tier,
          reviewUrl,
          reviewRedirectUrl,
          referralUrl: null,
          trackingUrl,
          coordinatorName,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to send email" },
        { status: 500 }
      );
    }

    await admin
      .from("review_requests")
      .update({
        status: "sent",
        email_sent_at: new Date().toISOString(),
        ...(rr.client_email ? {} : { client_email: clientEmail, client_name: displayName }),
      })
      .eq("id", rr.id);

    return NextResponse.json({ ok: true, action: "send" });
  }

  // action === "remind" (allowed when status is "sent" or already "reminded" so staff can send another reminder)
  if (rr.status !== "sent" && rr.status !== "reminded") {
    return NextResponse.json(
      { error: rr.status === "pending" ? "Send the initial request first" : "No reminder to send" },
      { status: 400 }
    );
  }

  const { data: moveRemind } = rr.move_id
    ? await admin.from("moves").select("client_email, client_name, quote_id").eq("id", rr.move_id).single()
    : { data: null };
  let reminderEmail = (rr.client_email || moveRemind?.client_email || "").trim();
  let reminderName = rr.client_name || moveRemind?.client_name || "Client";
  if (!reminderEmail && moveRemind?.quote_id) {
    const { data: quoteR } = await admin.from("quotes").select("contact_id").eq("id", moveRemind.quote_id).single();
    if (quoteR?.contact_id) {
      const { data: contactR } = await admin.from("contacts").select("email, name").eq("id", quoteR.contact_id).single();
      if (contactR?.email) {
        reminderEmail = (contactR.email || "").trim();
        if (contactR.name) reminderName = contactR.name;
      }
    }
  }
  if (!reminderEmail) {
    return NextResponse.json(
      { error: "No client email on review request, move, or quote contact. Save the client's email in Client contact details first." },
      { status: 400 }
    );
  }

  const token = signReviewToken(rr.id);
  const reviewUrl = `${baseUrl}/review?token=${encodeURIComponent(token)}`;
  const reviewRedirectUrl = `${baseUrl}/api/review/redirect?token=${encodeURIComponent(token)}`;

  try {
    await sendEmail({
      to: reminderEmail,
      subject: "Quick reminder your Yugo review",
      template: "review-request-reminder",
      data: {
        clientName: reminderName,
        reviewUrl,
        reviewRedirectUrl,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send reminder" },
      { status: 500 }
    );
  }

  await admin
    .from("review_requests")
    .update({
      status: "reminded",
      reminder_sent_at: new Date().toISOString(),
      ...(rr.client_email ? {} : { client_email: reminderEmail, client_name: reminderName }),
    })
    .eq("id", rr.id);

  return NextResponse.json({ ok: true, action: "remind" });
}
