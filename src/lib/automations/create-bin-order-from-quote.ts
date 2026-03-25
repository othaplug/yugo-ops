import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type QuoteRow = {
  id: string;
  quote_id: string;
  service_type: string | null;
  to_address: string | null;
  from_address: string | null;
  to_access: string | null;
  move_date: string | null;
  custom_price: number | null;
  deposit_amount: number | null;
  factors_applied: Record<string, unknown> | null;
};

/**
 * After a bin_rental quote is paid and a move row exists, create the linked bin_orders row.
 */
export async function createBinOrderFromBinRentalQuote(opts: {
  supabase: AdminClient;
  moveId: string;
  quote: QuoteRow;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  squarePaymentId?: string | null;
  squareCustomerId?: string | null;
  squareCardId?: string | null;
  depositAmount: number;
}): Promise<{ orderId: string; orderNumber: string } | null> {
  const { supabase, moveId, quote, clientName, clientEmail, clientPhone } = opts;
  if (quote.service_type !== "bin_rental") return null;

  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const bundleTypeRaw = String(f.bin_bundle_type ?? "2br");
  const bundleType = bundleTypeRaw === "custom" ? "individual" : bundleTypeRaw;

  const binCount = Math.max(1, Math.floor(Number(f.bin_count_total) || 1));
  const wardrobeProvided = Math.max(0, Math.floor(Number(f.bin_wardrobe_boxes) || 0));
  const dropOff = String(f.bin_drop_off_date ?? "");
  const pickup = String(f.bin_pickup_date ?? "");
  const moveDate = String(f.bin_move_date ?? quote.move_date ?? "");
  if (!dropOff || !pickup || !moveDate) {
    console.error("[createBinOrderFromBinRentalQuote] missing dates on quote factors");
    return null;
  }

  const subtotalPreTax = Number(quote.custom_price ?? f.bin_subtotal ?? 0);
  const totalPaid = opts.depositAmount;
  const hst = Math.max(0, Math.round(totalPaid - subtotalPreTax));

  const lines = Array.isArray(f.bin_line_items)
    ? (f.bin_line_items as { key?: string; amount?: number }[])
    : [];
  const deliverySur = lines
    .filter((l) => l.key === "material_delivery")
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const bundleLine = lines.find((l) => l.key === "bundle" || l.key === "custom_bins");
  const bundlePrice = bundleLine ? Number(bundleLine.amount) || 0 : subtotalPreTax - deliverySur;

  const { count } = await supabase
    .from("bin_orders")
    .select("id", { count: "exact", head: true });
  const seq = (count ?? 0) + 1;
  const orderNumber = `BIN-${String(seq).padStart(4, "0")}`;

  const delivery = (quote.to_address || "").trim();
  const pickupAddr = (quote.from_address || "").trim() || delivery;

  const { data: row, error } = await supabase
    .from("bin_orders")
    .insert({
      order_number: orderNumber,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || "",
      delivery_address: delivery,
      delivery_access: (quote.to_access as string) || "elevator",
      delivery_notes: (f.bin_delivery_notes as string) || null,
      pickup_address: pickupAddr !== delivery ? pickupAddr : null,
      bundle_type: bundleType,
      bin_count: binCount,
      wardrobe_boxes_provided: wardrobeProvided > 0 ? wardrobeProvided : null,
      includes_paper: f.bin_packing_paper === true,
      includes_zip_ties: true,
      move_date: moveDate,
      drop_off_date: dropOff,
      pickup_date: pickup,
      status: "confirmed",
      bundle_price: bundlePrice,
      delivery_surcharge: deliverySur,
      late_return_fees: 0,
      subtotal: subtotalPreTax,
      hst,
      total: totalPaid,
      square_payment_id: opts.squarePaymentId ?? null,
      square_customer_id: opts.squareCustomerId ?? null,
      square_card_id: opts.squareCardId ?? null,
      payment_status: "paid",
      move_id: moveId,
      source: "admin",
    })
    .select("id, order_number")
    .single();

  if (error || !row) {
    console.error("[createBinOrderFromBinRentalQuote] insert failed:", error);
    return null;
  }

  return { orderId: row.id, orderNumber: row.order_number };
}
