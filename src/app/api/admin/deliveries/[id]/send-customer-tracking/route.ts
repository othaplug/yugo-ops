/**
 * POST /api/admin/deliveries/[id]/send-customer-tracking
 *
 * Fires the customer (recipient) tracking notification for a delivery:
 *   1. Issues recipient_tracking_token if missing
 *   2. Sends the recipient SMS (and email, if present) with day,
 *      time window, brand, and a tracking URL
 *
 * Used when:
 *   - Admin created the delivery via /admin/deliveries/create when
 *     the auto-fire path didn't exist yet (recovery)
 *   - Customer asked to be re-sent the tracking link
 *   - Delivery was rescheduled and the customer needs a fresh nudge
 *
 * Mirrors sendB2BTrackingNotifications(..., { audiences: ['recipient'] }).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: slug } = await params;
  const db = createAdminClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    slug,
  );
  const q = db
    .from("deliveries")
    .select(
      "id, delivery_number, customer_name, customer_email, customer_phone, recipient_tracking_token, status",
    );
  const { data: del, error: delErr } = isUuid
    ? await q.eq("id", slug).maybeSingle()
    : await q.eq("delivery_number", slug).maybeSingle();

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  if (!del) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }
  if (!del.customer_phone?.trim() && !del.customer_email?.trim()) {
    return NextResponse.json(
      {
        error:
          "No customer_phone or customer_email on this delivery -- cannot reach the end customer.",
      },
      { status: 400 },
    );
  }

  let tokenIssued = false;
  if (!del.recipient_tracking_token) {
    try {
      const t = await issueDeliveryTrackingTokens(del.id);
      tokenIssued = !!t.recipientToken;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Failed to issue tracking token: " +
            (err instanceof Error ? err.message : String(err)),
        },
        { status: 500 },
      );
    }
  }

  try {
    await sendB2BTrackingNotifications(del.id, { audiences: ["recipient"] });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Tracking token issued but notification send failed: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 500 },
    );
  }

  await logAudit({
    userEmail: user?.email ?? null,
    action: "edit_move",
    resourceType: "delivery",
    resourceId: del.id,
    details: {
      kind: "customer_tracking_notification_sent",
      delivery_number: del.delivery_number,
      token_issued: tokenIssued,
      to_phone: del.customer_phone ?? null,
      to_email: del.customer_email ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    delivery_number: del.delivery_number,
    token_issued: tokenIssued,
    sent_to: [
      del.customer_phone ? `SMS ${del.customer_phone}` : null,
      del.customer_email ? `email ${del.customer_email}` : null,
    ].filter(Boolean),
  });
}
