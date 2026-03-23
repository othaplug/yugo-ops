import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/partners/[partnerId]/card-capture
 *
 * Body: { sourceId: string }
 *
 * Creates (or reuses) a Square customer for the partner org,
 * stores the tokenised card, and persists card metadata on the
 * organizations row (square_customer_id, square_card_id, card_last_four,
 * card_brand, card_on_file).
 *
 * Card details never touch OPS+ servers — Square handles PCI scope.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`partner-card:${ip}`, 5, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { partnerId } = await params;
  const body = await req.json().catch(() => ({}));
  const { sourceId } = body as { sourceId?: string };

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: partner, error: fetchErr } = await supabase
    .from("organizations")
    .select("id, name, email, billing_email, phone, square_customer_id")
    .eq("id", partnerId)
    .single();

  if (fetchErr || !partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const partnerEmail = partner.billing_email || partner.email || "";
  const partnerName = partner.name || "Partner";

  // ── Find or create Square customer ──────────────────────────────────────
  let squareCustomerId: string = partner.square_customer_id || "";

  if (!squareCustomerId && partnerEmail) {
    try {
      const searchRes = await squareClient.customers.search({
        query: { filter: { emailAddress: { exact: partnerEmail } } },
      });
      squareCustomerId = searchRes.customers?.[0]?.id ?? "";
    } catch {
      // proceed to create
    }
  }

  if (!squareCustomerId) {
    try {
      const createRes = await squareClient.customers.create({
        companyName: partnerName,
        emailAddress: partnerEmail || undefined,
        phoneNumber: partner.phone || undefined,
        referenceId: partnerId,
      });
      squareCustomerId = createRes.customer?.id ?? "";
    } catch (e) {
      console.error("[Square] partner customer create failed:", e);
      return NextResponse.json({ error: "Failed to create Square customer profile" }, { status: 500 });
    }
  }

  if (!squareCustomerId) {
    return NextResponse.json({ error: "Could not establish Square customer" }, { status: 500 });
  }

  // ── Store card on file ───────────────────────────────────────────────────
  let squareCardId = "";
  let cardLastFour = "";
  let cardBrand = "";

  try {
    const { locationId } = await getSquarePaymentConfig();
    void locationId; // location not required for card-on-file storage

    const cardRes = await squareClient.cards.create({
      sourceId,
      card: { customerId: squareCustomerId },
      idempotencyKey: `partner-card-${partnerId}-${Date.now()}`,
    });
    squareCardId  = cardRes.card?.id ?? "";
    cardLastFour  = cardRes.card?.last4 ?? "";
    cardBrand     = cardRes.card?.cardBrand ?? "";
  } catch (e) {
    console.error("[Square] partner card store failed:", e);
    return NextResponse.json({ error: "Failed to store card — please retry" }, { status: 502 });
  }

  // ── Persist to organizations ─────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("organizations")
    .update({
      square_customer_id: squareCustomerId,
      square_card_id: squareCardId,
      card_last_four: cardLastFour,
      card_brand: cardBrand,
      card_on_file: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    square_customer_id: squareCustomerId,
    square_card_id: squareCardId,
    card_last_four: cardLastFour,
    card_brand: cardBrand,
  });
}

/**
 * DELETE /api/admin/partners/[partnerId]/card-capture
 * Removes card on file (admin use — e.g. partner requests removal).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { partnerId } = await params;
  const supabase = createAdminClient();

  const { data: partner, error: fetchErr } = await supabase
    .from("organizations")
    .select("square_card_id")
    .eq("id", partnerId)
    .single();

  if (fetchErr || !partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  if (partner.square_card_id) {
    try {
      await squareClient.cards.disable(partner.square_card_id);
    } catch {
      // best-effort — still clear from DB
    }
  }

  await supabase
    .from("organizations")
    .update({
      square_card_id: null,
      card_last_four: null,
      card_brand: null,
      card_on_file: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);

  return NextResponse.json({ success: true });
}
