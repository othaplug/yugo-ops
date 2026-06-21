import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import {
  squarePaymentErrorsToMessage,
  squareThrownErrorMessage,
} from "@/lib/square-payment-errors";
import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";
import { internalAdminAlertEmail } from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const HST = 0.13;

// Only these residential supply add-ons can be self-purchased from the track
// page. Each must be a physical item the crew can bring on move day.
const SUPPLY_SLUGS = [
  "packing_materials",
  "wardrobe_boxes",
  "mattress_bag",
  "picture_crating",
] as const;

type RequestedItem = { slug: string; quantity?: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`supplies-order:${ip}`, 6, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { items?: RequestedItem[]; sourceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const requested = Array.isArray(body.items) ? body.items : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: "Please choose at least one item." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Load the move (client snapshot + card on file) ──
  const { data: move, error: moveError } = await supabase
    .from("moves")
    .select(
      "id, client_name, client_email, client_phone, move_code, status, to_address, square_customer_id, square_card_id",
    )
    .eq("id", moveId)
    .single();

  if (moveError || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const st = String(move.status || "").toLowerCase();
  if (["completed", "cancelled", "canceled"].includes(st)) {
    return NextResponse.json(
      { error: "Supplies can only be added before your move." },
      { status: 400 },
    );
  }

  // ── Load the priced add-ons from the catalog (server is source of truth) ──
  const { data: catalog, error: catErr } = await supabase
    .from("addons")
    .select("slug, name, price, price_type, unit_label, active")
    .in("slug", SUPPLY_SLUGS as unknown as string[])
    .eq("active", true);

  if (catErr || !catalog) {
    return NextResponse.json({ error: "Unable to load supplies." }, { status: 500 });
  }

  const bySlug = new Map(catalog.map((a) => [a.slug, a]));

  // ── Build validated line items + totals ──
  const lineItems: {
    slug: string;
    name: string;
    unit_label: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[] = [];

  for (const r of requested) {
    const addon = bySlug.get(r.slug);
    if (!addon) continue;
    const qty = Math.max(0, Math.min(50, Math.floor(Number(r.quantity ?? 1))));
    if (qty <= 0) continue;
    const unitPrice = Number(addon.price) || 0;
    // flat items are charged once regardless of qty; per_unit scales with qty.
    const isPerUnit = addon.price_type === "per_unit";
    const effectiveQty = isPerUnit ? qty : 1;
    const lineTotal = Math.round(unitPrice * effectiveQty * 100) / 100;
    lineItems.push({
      slug: addon.slug,
      name: addon.name,
      unit_label: addon.unit_label ?? null,
      unit_price: unitPrice,
      quantity: effectiveQty,
      line_total: lineTotal,
    });
  }

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No valid supplies selected." }, { status: 400 });
  }

  const subtotal = Math.round(lineItems.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  const hst = Math.round(subtotal * HST * 100) / 100;
  const total = Math.round((subtotal + hst) * 100) / 100;
  const amountCents = Math.round(total * 100);

  // ── Resolve the card to charge: explicit sourceId (new card) wins, else
  //    the move's saved card, else the first card on the Square customer. ──
  let cardId: string | null = body.sourceId?.trim() || move.square_card_id || null;
  const customerId = move.square_customer_id || null;

  if (!cardId && customerId) {
    try {
      const listRes = await squareClient.cards.list({ customerId, sortOrder: "ASC" });
      const cards = listRes.data ?? [];
      cardId = cards.length > 0 ? (cards[0].id ?? null) : null;
    } catch {
      /* fall through to the no-card error */
    }
  }

  if (!cardId) {
    return NextResponse.json(
      { error: "No card on file. Please contact us to add a payment method." },
      { status: 400 },
    );
  }

  // ── Order number ── (also a pre-charge guard: if the supplies_orders table
  // is missing we bail HERE, before charging, so we never take money we can't
  // record against an order.)
  const { count, error: countErr } = await supabase
    .from("supplies_orders")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    console.error("[supplies] storage unavailable, refusing to charge:", countErr);
    return NextResponse.json(
      { error: "Supplies ordering is not available right now. Please contact us." },
      { status: 503 },
    );
  }
  const seq = (count ?? 0) + 1;
  const orderNumber = `SUP-${String(seq).padStart(4, "0")}-${Date.now().toString(36).slice(-3).toUpperCase()}`;

  // ── Charge ──
  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) {
    return NextResponse.json({ error: "Payment is not configured." }, { status: 503 });
  }

  let squarePaymentId: string | undefined;
  try {
    const paymentRes = await squareClient.payments.create({
      sourceId: cardId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: customerId ?? undefined,
      referenceId: orderNumber,
      note: `Yugo supplies ${orderNumber} — ${move.client_name || moveId}`,
      idempotencyKey: `supplies-${orderNumber}`,
      locationId,
    });
    if (paymentRes.errors && paymentRes.errors.length > 0) {
      return NextResponse.json(
        { error: squarePaymentErrorsToMessage(paymentRes.errors) },
        { status: 400 },
      );
    }
    squarePaymentId = paymentRes.payment?.id;
    if (!squarePaymentId) {
      return NextResponse.json(
        { error: "Payment could not be completed. Please try again." },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[supplies] payment failed:", err);
    return NextResponse.json({ error: squareThrownErrorMessage(err) }, { status: 500 });
  }

  // ── Persist ──
  const { data: order, error: insertErr } = await supabase
    .from("supplies_orders")
    .insert({
      order_number: orderNumber,
      move_id: move.id,
      client_name: move.client_name || null,
      client_email: move.client_email || null,
      client_phone: move.client_phone || null,
      items: lineItems,
      subtotal,
      hst,
      total,
      square_payment_id: squarePaymentId,
      square_customer_id: customerId,
      square_card_id: cardId,
      payment_status: "paid",
      status: "confirmed",
      fulfillment: "with_crew",
    })
    .select("id")
    .single();

  if (insertErr || !order) {
    // Payment succeeded but the row failed — surface so support can reconcile.
    console.error("[supplies] insert failed after charge:", insertErr, { orderNumber, squarePaymentId });
    return NextResponse.json(
      { error: "Your payment went through but we hit a snag saving the order. We will reach out to confirm." },
      { status: 500 },
    );
  }

  // ── Notifications (fire-and-forget) ──
  const firstName = (move.client_name || "there").split(" ")[0];
  const itemsLine = lineItems
    .map((l) => `${l.name}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`)
    .join(", ");

  if (move.client_phone) {
    sendSMS(
      move.client_phone,
      [
        `Hi ${firstName},`,
        `Your moving supplies are confirmed and will arrive with your crew on move day.`,
        itemsLine,
        `Total: $${total.toFixed(2)} CAD. Order ${orderNumber}.`,
        `We are here if you need anything.`,
      ].join("\n\n"),
    ).catch(() => {});
  }

  if (move.client_email) {
    sendEmail({
      to: move.client_email,
      subject: `Your moving supplies are confirmed, ${orderNumber}`,
      html: buildSuppliesEmail({
        firstName,
        orderNumber,
        lineItems,
        subtotal,
        hst,
        total,
      }),
    }).catch(() => {});
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (adminEmail) {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.yugoplus.co";
    sendEmail({
      to: adminEmail,
      subject: `Supplies order ${orderNumber}, ${move.client_name || "client"}`,
      html: internalAdminAlertEmail({
        kicker: "New supplies order",
        title: `${move.client_name || "Client"} — ${orderNumber}`,
        summary: `A client purchased moving supplies from their track page. Load these onto the truck for move day.`,
        keyValues: [
          { label: "Order", value: orderNumber, accent: "forest" },
          { label: "Move", value: move.move_code || move.id },
          { label: "Items", value: itemsLine },
          { label: "Deliver to", value: move.to_address || "—" },
          { label: "Total", value: `$${total.toFixed(2)}`, accent: "forest" },
        ],
        primaryCta: { label: "Open the move", url: `${base}/admin/moves/${move.id}` },
        tone: "info",
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    orderNumber,
    orderId: order.id,
    subtotal,
    hst,
    total,
  });
}

function buildSuppliesEmail(d: {
  firstName: string;
  orderNumber: string;
  lineItems: { name: string; quantity: number; line_total: number }[];
  subtotal: number;
  hst: number;
  total: number;
}): string {
  const rows = d.lineItems
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e0d8;color:#3E4D40">${l.name}${l.quantity > 1 ? ` &times;${l.quantity}` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;color:#2C3E2D">$${l.line_total.toFixed(2)}</td></tr>`,
    )
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f7f4ee;color:#2C3E2D">
      <h1 style="font-size:23px;margin:0 0 8px;color:#2C3E2D">Your supplies are sorted, ${d.firstName}.</h1>
      <p style="color:#5A6B5E;margin:0 0 24px">Order <strong style="color:#2C3E2D">${d.orderNumber}</strong> is confirmed. Your crew will bring everything with them on move day, so there is nothing to wait in for.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
        ${rows}
        <tr><td style="padding:8px 0;color:#5A6B5E">HST</td><td style="padding:8px 0;text-align:right;color:#5A6B5E">$${d.hst.toFixed(2)}</td></tr>
        <tr><td style="padding:10px 0;color:#2C3E2D;font-weight:bold">Total</td><td style="padding:10px 0;text-align:right;color:#2C3E2D;font-weight:bold">$${d.total.toFixed(2)} CAD</td></tr>
      </table>
      <p style="font-size:13px;color:#7a857c;margin-top:24px">Charged to the card on file. We are always available at <strong>(647) 370-4525</strong>.</p>
    </div>
  `;
}
