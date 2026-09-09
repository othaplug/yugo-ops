import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { resolveDeliveryUuidFromApiPathSegment } from "@/lib/delivery-resolve-id";
import { sendB2BOneOffDeliveryInvoice } from "@/lib/invoices/send-b2b-oneoff-invoice";

/**
 * Creates a Square invoice for a B2B one-off delivery (no partner org), emails the business
 * contact when contact_email is present, and stores a row in invoices for admin.
 *
 * The enriched invoice logic lives in sendB2BOneOffDeliveryInvoice so the bulk
 * "Send invoices" action produces byte-identical invoices; this route only
 * resolves the id and maps the shared result to HTTP status codes.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  let body: { deliveryId?: string; deliveryNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawId = String(body.deliveryId || "").trim();
  const rawNumber = String(body.deliveryNumber || "").trim();
  if (!rawId && !rawNumber) {
    return NextResponse.json({ error: "deliveryId or deliveryNumber required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let deliveryUuid = rawId ? await resolveDeliveryUuidFromApiPathSegment(admin, rawId) : null;
  if (!deliveryUuid && rawNumber) {
    deliveryUuid = await resolveDeliveryUuidFromApiPathSegment(admin, rawNumber);
  }
  if (!deliveryUuid) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const result = await sendB2BOneOffDeliveryInvoice(admin, deliveryUuid);

  if (result.status === "created") {
    return NextResponse.json({
      id: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      squareInvoiceId: result.squareInvoiceId,
      squareInvoiceUrl: result.squareInvoiceUrl,
    });
  }

  if (result.status === "skipped") {
    // "Invoice already exists" is a benign 200 (matches prior contract); every
    // other skip is an operator-fixable precondition (400).
    if (result.reason === "Invoice already exists") {
      return NextResponse.json({
        message: "Invoice already exists",
        id: result.invoiceId,
        squareInvoiceUrl: result.squareInvoiceUrl,
      });
    }
    return NextResponse.json({ error: skipReasonToMessage(result.reason) }, { status: 400 });
  }

  // status === "error"
  const status = result.reason.startsWith("Square invoice could not be created") ? 502 : 500;
  if (status === 500) {
    console.error("[delivery-b2b-one-off-invoice] failed:", result.reason);
  }
  return NextResponse.json({ error: skipReasonToMessage(result.reason) }, { status });
}

/** Map the shared function's terse reasons back to this route's operator-facing copy. */
function skipReasonToMessage(reason: string): string {
  switch (reason) {
    case "Partner-billed (invoiced via statements)":
      return "Square invoice for B2B one-off deliveries only (no partner account on file).";
    case "No business contact email":
      return "Business contact email is required to send a Square invoice.";
    case "No price set":
      return "Set a quoted or total price before sending an invoice.";
    case "Square invoice could not be created (check Square config)":
      return "Square invoice could not be created. Check SQUARE_ACCESS_TOKEN and location configuration.";
    default:
      return reason;
  }
}
