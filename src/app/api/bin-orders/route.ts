import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/api-auth";

const GTA_POSTAL_PREFIXES = ["L4", "L5", "L6", "L3", "L1"];
const HST = 0.13;
const MISSING_BIN_FEE = 20;

export const dynamic = "force-dynamic";

// ── POST /api/bin-orders — create a new bin order with Square payment ──

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`bin-order:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      sourceId,
      clientName,
      clientEmail,
      clientPhone,
      deliveryAddress,
      deliveryPostal,
      deliveryAccess,
      deliveryNotes,
      bundleType,
      binCount,
      moveDate,
      includesPaper,
      includesZipTies,
      moveId,
      source,
    } = body as {
      sourceId: string;
      clientName: string;
      clientEmail: string;
      clientPhone: string;
      deliveryAddress: string;
      deliveryPostal?: string;
      deliveryAccess?: string;
      deliveryNotes?: string;
      bundleType: string;
      binCount: number;
      moveDate: string;
      includesPaper?: boolean;
      includesZipTies?: boolean;
      moveId?: string;
      source?: string;
    };

    if (!sourceId || !clientName || !clientEmail || !clientPhone || !deliveryAddress || !bundleType || !binCount || !moveDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── Calculate pricing ──
    const bundlePrices: Record<string, number> = {
      studio: 109, "1br": 189, "2br": 289, "3br": 429, "4br_plus": 579,
    };
    const bundlePricePer: Record<string, number> = { individual: 6 };

    let bundlePrice = bundleType === "individual"
      ? (bundlePricePer.individual * binCount)
      : (bundlePrices[bundleType] ?? 109);

    const postal = (deliveryPostal || "").toUpperCase();
    const isGTA = GTA_POSTAL_PREFIXES.some((prefix) => postal.startsWith(prefix));
    const deliverySurcharge = isGTA ? 35 : 0;

    const subtotal = bundlePrice + deliverySurcharge;
    const hst = Math.round(subtotal * HST * 100) / 100;
    const total = Math.round((subtotal + hst) * 100) / 100;

    // ── Calculate dates ──
    const moveDateObj = new Date(moveDate);
    const dropOffDate = new Date(moveDateObj);
    dropOffDate.setDate(dropOffDate.getDate() - 7);
    const pickupDate = new Date(moveDateObj);
    pickupDate.setDate(pickupDate.getDate() + 5);

    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    // ── Generate order number (count-based + random suffix for uniqueness) ──
    const { count: orderCount } = await supabase
      .from("bin_orders")
      .select("id", { count: "exact", head: true });
    const seqNum = (orderCount ?? 0) + 1;
    const orderNumber = `BIN-${String(seqNum).padStart(4, "0")}-${Date.now().toString(36).slice(-3).toUpperCase()}`;

    // ── Square: create/find customer ──
    let squareCustomerId: string | undefined;
    try {
      const searchRes = await squareClient.customers.search({
        query: { filter: { emailAddress: { exact: clientEmail } } },
      });
      squareCustomerId = searchRes.customers?.[0]?.id;
    } catch { /* create new */ }

    if (!squareCustomerId) {
      const [firstName, ...lastParts] = clientName.trim().split(" ");
      try {
        const createRes = await squareClient.customers.create({
          givenName: firstName,
          familyName: lastParts.join(" ") || ".",
          emailAddress: clientEmail,
          phoneNumber: clientPhone,
        });
        squareCustomerId = createRes.customer?.id;
      } catch (e) {
        console.error("[Square] customer create failed:", e);
        return NextResponse.json({ error: "Failed to create customer profile" }, { status: 500 });
      }
    }

    // ── Square: store card ──
    let squareCardId: string | undefined;
    try {
      const cardRes = await squareClient.cards.create({
        sourceId,
        card: { customerId: squareCustomerId! },
        idempotencyKey: `bin-card-${orderNumber}`,
      });
      squareCardId = cardRes.card?.id;
    } catch (e) {
      console.error("[Square] card storage failed:", e);
    }

    // ── Square: charge payment ──
    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
    }

    const amountCents = Math.round(total * 100);
    let squarePaymentId: string | undefined;

    try {
      const paymentRes = await squareClient.payments.create({
        sourceId: squareCardId ?? sourceId,
        amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
        customerId: squareCustomerId,
        referenceId: orderNumber,
        note: `Yugo bin rental ${orderNumber}`,
        idempotencyKey: `bin-pay-${orderNumber}`,
        locationId,
      });
      squarePaymentId = paymentRes.payment?.id;
      if (!squarePaymentId) {
        return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      console.error("[Square] bin payment failed:", e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Insert bin_order ──
    const { data: binOrder, error: insertErr } = await supabase
      .from("bin_orders")
      .insert({
        order_number: orderNumber,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        delivery_address: deliveryAddress,
        delivery_postal: deliveryPostal || null,
        delivery_access: deliveryAccess || "elevator",
        delivery_notes: deliveryNotes || null,
        bundle_type: bundleType,
        bin_count: binCount,
        includes_paper: includesPaper !== false,
        includes_zip_ties: includesZipTies !== false,
        move_date: toDateStr(moveDateObj),
        drop_off_date: toDateStr(dropOffDate),
        pickup_date: toDateStr(pickupDate),
        status: "confirmed",
        bundle_price: bundlePrice,
        delivery_surcharge: deliverySurcharge,
        subtotal,
        hst,
        total,
        square_payment_id: squarePaymentId,
        square_customer_id: squareCustomerId || null,
        square_card_id: squareCardId || null,
        payment_status: "paid",
        move_id: moveId || null,
        source: source || "standalone",
      })
      .select("*")
      .single();

    if (insertErr || !binOrder) {
      console.error("[bin-orders] insert failed:", insertErr);
      return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
    }

    // ── Notifications (fire-and-forget) ──
    sendSMS(
      clientPhone,
      [
        `Hi ${clientName.split(" ")[0]},`,
        `Your Yugo bin order is confirmed.`,
        `Order: ${orderNumber}`,
        `Drop-off: ${formatDateShort(dropOffDate)}`,
        `Move date: ${formatDateShort(moveDateObj)}`,
        `Pickup: ${formatDateShort(pickupDate)}`,
        `We are here if you need anything. Call (647) 370-4525.`,
      ].join("\n\n"),
    ).catch(() => {});

    sendEmail({
      to: clientEmail,
      subject: `Your Yugo bin order is confirmed, ${orderNumber}`,
      html: buildConfirmationEmail({
        orderNumber,
        clientName,
        bundleType,
        binCount,
        dropOffDate: formatDateShort(dropOffDate),
        moveDate: formatDateShort(moveDateObj),
        pickupDate: formatDateShort(pickupDate),
        total,
      }),
    }).catch(() => {});

    // Notify admin
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `New bin order ${orderNumber}, ${clientName}`,
        html: `<p>New bin rental: <strong>${orderNumber}</strong><br>Client: ${clientName} (${clientEmail})<br>Bundle: ${bundleType} (${binCount} bins)<br>Address: ${deliveryAddress}<br>Move: ${formatDateShort(moveDateObj)} | Drop-off: ${formatDateShort(dropOffDate)} | Pickup: ${formatDateShort(pickupDate)}<br>Total: $${total.toFixed(2)}</p><p><a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://helloyugo.com"}/admin/bin-rentals/${binOrder.id}">View in admin</a></p>`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      orderNumber,
      orderId: binOrder.id,
      dropOffDate: toDateStr(dropOffDate),
      moveDate: toDateStr(moveDateObj),
      pickupDate: toDateStr(pickupDate),
      total,
    });
  } catch (e) {
    console.error("[bin-orders/POST] unexpected error:", e);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

// ── GET /api/bin-orders — admin list (requires auth) ──

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  let query = supabase
    .from("bin_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data });
}

// ── Helpers ──

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function buildConfirmationEmail(d: {
  orderNumber: string; clientName: string; bundleType: string; binCount: number;
  dropOffDate: string; moveDate: string; pickupDate: string; total: number;
}): string {
  const firstName = d.clientName.split(" ")[0];
  const bundleLabel: Record<string, string> = {
    studio: "Studio", "1br": "1 Bedroom", "2br": "2 Bedroom",
    "3br": "3 Bedroom", "4br_plus": "4 Bedroom+", individual: "Custom",
  };
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e0d8">
      <h1 style="color:#2C3E2D;font-size:24px;margin:0 0 8px">Your bins are on the way, ${firstName}.</h1>
      <p style="color:#9ca3af;margin:0 0 24px">Order <strong style="color:#e5e0d8">${d.orderNumber}</strong> - everything is confirmed and scheduled.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#9ca3af">Bundle</td><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right">${bundleLabel[d.bundleType] || d.bundleType} (${d.binCount} bins)</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#9ca3af">Bin delivery</td><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right">${d.dropOffDate}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#9ca3af">Move date</td><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right">${d.moveDate}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#9ca3af">Bin collection</td><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;text-align:right">${d.pickupDate}</td></tr>
        <tr><td style="padding:8px 0;color:#2C3E2D;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;color:#2C3E2D;font-weight:bold">$${d.total.toFixed(2)} CAD</td></tr>
      </table>
      <div style="background:#1a1a1a;border-radius:8px;padding:16px;margin-bottom:24px">
        <h3 style="color:#2C3E2D;margin:0 0 12px;font-size:14px">Here is what to expect</h3>
        <p style="margin:0 0 8px;font-size:14px"><span style="color:#2C3E2D;font-weight:bold">&#9655;</span> <strong>Your bins arrive ${d.dropOffDate}</strong> between 9 AM and 5 PM. Take your time packing.</p>
        <p style="margin:0 0 8px;font-size:14px"><span style="color:#2C3E2D;font-weight:bold">&#9655;</span> <strong>On your move date, ${d.moveDate},</strong> leave the bins stacked near your door and we will handle the rest.</p>
        <p style="margin:0;font-size:14px"><span style="color:#2C3E2D;font-weight:bold">&#9655;</span> <strong>We collect the bins on ${d.pickupDate}</strong> between 9 AM and 5 PM.</p>
      </div>
      <p style="font-size:13px;color:#6b7280">You will receive a reminder the day before each delivery and collection with a 2-hour window. We are always available at <strong>(647) 370-4525</strong>.</p>
      <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0"/>
      <p style="font-size:13px;color:#6b7280">Planning the move itself too? <a href="https://liveyugo.com" style="color:#2C3E2D">Get your Yugo moving quote here.</a></p>
    </div>
  `;
}

// Export for use in cron jobs
export { MISSING_BIN_FEE };
