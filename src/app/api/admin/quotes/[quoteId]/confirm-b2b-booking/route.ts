/**
 * POST /api/admin/quotes/[quoteId]/confirm-b2b-booking
 *
 * Admin-side "Confirm booking (invoice)" for a B2B commercial-delivery quote.
 * Approves on the client's behalf with NO card taken: marks the quote
 * accepted / invoiced and creates the delivery at $0. The invoice is raised
 * after the job is completed (the delivery completion hook), matching the
 * client self-serve path (`accept-b2b-invoice`). Admin-authed; the client
 * name/email come from the quote's contact.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import { runPostPaymentActionsB2BDelivery } from "@/lib/automations/post-payment";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";
import { logAudit } from "@/lib/audit";
import { isBeforeToday } from "@/lib/business-timezone";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { quoteId } = await params;
  if (!quoteId) return NextResponse.json({ error: "Quote id required" }, { status: 400 });

  // Optional crew + on-site contact captured at confirm time.
  //  - crew so the delivery is never created crew-less (invisible to the crew).
  //  - an on-site contact (distinct from the business contact) so the tracking
  //    confirmation reaches BOTH the business and the person receiving on site.
  let crewId: string | null = null;
  let onsiteName: string | null = null;
  let onsitePhone: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      crew_id?: string | null;
      onsite_name?: string | null;
      onsite_phone?: string | null;
    };
    crewId = typeof body.crew_id === "string" && body.crew_id.trim() ? body.crew_id.trim() : null;
    onsiteName = typeof body.onsite_name === "string" && body.onsite_name.trim() ? body.onsite_name.trim() : null;
    onsitePhone = typeof body.onsite_phone === "string" && body.onsite_phone.trim() ? body.onsite_phone.trim() : null;
  } catch {
    crewId = null;
  }

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select(
      "id, quote_id, status, service_type, selected_tier, selected_addons, factors_applied, move_date, contacts:contact_id(name, email, phone)",
    )
    .eq("quote_id", quoteId)
    .single();
  if (qErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  if (!isB2BDeliveryQuoteServiceType(String(quote.service_type ?? ""))) {
    return NextResponse.json(
      { error: "This action is only for commercial delivery quotes." },
      { status: 400 },
    );
  }

  // Idempotent: a delivery already exists for this quote, just report it.
  const { data: existingDel } = await admin
    .from("deliveries")
    .select("id, delivery_number")
    .eq("source_quote_id", quote.id)
    .maybeSingle();
  if (existingDel) {
    return NextResponse.json({
      success: true,
      already: true,
      delivery_id: existingDel.id,
      delivery_number: existingDel.delivery_number,
    });
  }

  // The delivery inherits the quote's move_date. The crew app only lists jobs
  // scheduled for TODAY and the calendar shows the scheduled day, so confirming
  // onto a missing or past date creates a delivery the crew never sees (this is
  // exactly what stranded DLV-30406). Refuse and make the operator set a real
  // date first, rather than silently booking into a dead date.
  const moveDate = String(quote.move_date ?? "").slice(0, 10);
  if (!moveDate) {
    return NextResponse.json(
      { error: "This quote has no delivery date. Set a delivery date on the quote before confirming." },
      { status: 400 },
    );
  }
  // isBeforeToday() encapsulates the padded-YYYY-MM-DD compare. NEVER
  // inline a toLocaleDateString-based compare here — see the hazard
  // note atop business-timezone.ts (YG-30422 incident: Sep 5 rejected
  // on Sep 4 with "already passed" because the day was unpadded).
  if (isBeforeToday(moveDate)) {
    return NextResponse.json(
      {
        error: `The delivery date (${moveDate}) has already passed. Update the quote's delivery date to today or later, then confirm.`,
      },
      { status: 400 },
    );
  }

  const contact = quote.contacts as { name?: string; email?: string } | null;
  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const clientName =
    contact?.name?.trim() ||
    (typeof factors.b2b_business_name === "string" ? factors.b2b_business_name : "") ||
    "Client";
  const clientEmail = contact?.email?.trim() || "";
  if (!clientEmail) {
    return NextResponse.json(
      { error: "The client has no email on file. Add a contact email before confirming." },
      { status: 400 },
    );
  }

  // Mark the quote accepted + invoiced (no card), mirroring accept-b2b-invoice.
  await admin
    .from("quotes")
    .update({
      status: "accepted",
      payment_status: "invoiced",
      selected_tier: quote.selected_tier ?? "custom",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  let delivery: { deliveryId: string; deliveryNumber: string };
  try {
    delivery = await createDeliveryFromB2BQuote({
      quoteId: quote.quote_id,
      depositAmount: 0,
      selectedTier: quote.selected_tier ?? null,
      selectedAddons: (quote.selected_addons as unknown[]) ?? [],
      clientName,
      clientEmail,
    });
  } catch (e) {
    console.error("[confirm-b2b-booking] delivery creation failed", e);
    return NextResponse.json({ error: "Could not create the delivery." }, { status: 500 });
  }

  // On-site recipient (if given): store it as the delivery's customer_* so it is
  // DISTINCT from the business contact (contact_*). That distinctness is what
  // makes issueDeliveryTrackingTokens mint a recipient token and
  // sendB2BTrackingNotifications reach the on-site person as well as the business.
  if (onsitePhone || onsiteName) {
    try {
      await admin
        .from("deliveries")
        .update({
          customer_name: onsiteName || clientName,
          customer_phone: onsitePhone || null,
          customer_email: null,
          recipient_mode: "separate",
        })
        .eq("id", delivery.deliveryId);
    } catch (e) {
      console.error("[confirm-b2b-booking] on-site recipient update failed", e);
    }
  }

  // Assign the crew now (if picked) so the job reaches them on the schedule: set
  // crew_id + names on the delivery, then sync the crew_schedule_block that the
  // crew app + calendar read.
  if (crewId) {
    try {
      const snap = await fetchCrewAssignmentSnapshot(admin, crewId);
      await admin
        .from("deliveries")
        .update({
          crew_id: crewId,
          assigned_crew_name: snap.assigned_crew_name,
          assigned_members: snap.assigned_members,
        })
        .eq("id", delivery.deliveryId);
      await ensureB2bDeliverySchedule(admin, delivery.deliveryId);
    } catch (e) {
      console.error("[confirm-b2b-booking] crew assignment failed", e);
    }
  }

  try {
    await issueDeliveryTrackingTokens(delivery.deliveryId);
    await sendB2BTrackingNotifications(delivery.deliveryId);
  } catch (e) {
    console.error("[confirm-b2b-booking] tracking notify failed", e);
  }

  const capturedId = delivery.deliveryId;
  const capturedNumber = delivery.deliveryNumber;
  after(async () => {
    try {
      await runPostPaymentActionsB2BDelivery({
        quoteId: quote.quote_id,
        deliveryId: capturedId,
        deliveryNumber: capturedNumber,
        paymentId: "invoice-booking",
        amount: 0,
      });
    } catch (e) {
      console.error("[confirm-b2b-booking] post-payment", e);
    }
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "b2b_booking_confirmed",
    resourceType: "quote",
    resourceId: quote.quote_id,
    details: { delivery_number: delivery.deliveryNumber, invoiced: true, by: "admin" },
  });

  return NextResponse.json({
    success: true,
    delivery_id: delivery.deliveryId,
    delivery_number: delivery.deliveryNumber,
  });
}
