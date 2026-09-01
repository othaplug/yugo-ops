import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const PLASTIC_BIN_SLUG = "plastic_bin_rental";
const HST_RATE = 0.13;
const DEFAULT_RENTAL_DAYS = 7; // pickup is drop-off + 7 days (business rule).

/** Add N days to a YYYY-MM-DD date string, returning YYYY-MM-DD (no timezone drift). */
function addDaysISO(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

type BinAddonSelection = {
  addon_id?: string;
  slug?: string;
  tier_index?: number;
};

/**
 * When a residential move carries a `plastic_bin_rental` ADD-ON (not a standalone
 * bin_rental booking), the bins still have to be delivered and collected, but no
 * `bin_orders` row was ever created, so they never appeared on the bin rentals
 * fulfillment page (see MV-30378: 30 bins invisible to ops). This creates the
 * linked bin order so the add-on bins are tracked and dispatched like any other.
 *
 * The add-on is already charged on the move, so the bin order is marked paid and
 * tagged `source: "move_addon"` (a revenue report can exclude these to avoid
 * double counting). Drop-off seeds to the move date as a placeholder for the
 * coordinator to confirm; pickup is drop-off + 7 days.
 *
 * Idempotent: skips if a bin order already exists for this move.
 */
export async function createBinOrderFromMoveAddon(opts: {
  supabase: AdminClient;
  moveId: string;
  moveCode: string;
  serviceType: string | null;
  scheduledDate: string | null;
  fromAddress: string | null;
  fromAccess: string | null;
  addons: BinAddonSelection[] | null | undefined;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  squarePaymentId?: string | null;
  squareCustomerId?: string | null;
  squareCardId?: string | null;
}): Promise<{ orderId: string; orderNumber: string } | null> {
  const {
    supabase,
    moveId,
    moveCode,
    serviceType,
    scheduledDate,
    fromAddress,
    fromAccess,
    addons,
    clientName,
    clientEmail,
    clientPhone,
  } = opts;

  // Standalone bin_rental bookings get their bin order from the dedicated flow.
  if (serviceType === "bin_rental") return null;

  const binSel = (addons ?? []).find((a) => a?.slug === PLASTIC_BIN_SLUG);
  if (!binSel) return null;

  // One bin order per move, and never a duplicate on re-run / backfill.
  const { data: existing } = await supabase
    .from("bin_orders")
    .select("id, order_number")
    .eq("move_id", moveId)
    .limit(1)
    .maybeSingle();
  if (existing) return { orderId: existing.id, orderNumber: existing.order_number };

  // Resolve the selected tier's bin count + bundle from the catalog.
  const { data: addonRow } = await supabase
    .from("addons")
    .select("tiers")
    .eq("slug", PLASTIC_BIN_SLUG)
    .maybeSingle();
  const tiers = (addonRow?.tiers as
    | { bins?: number; bundle?: string; price?: number; label?: string }[]
    | null) ?? null;
  const tier = tiers?.[binSel.tier_index ?? 0];
  if (!tier) return null;

  const binCount = Math.max(1, Math.floor(Number(tier.bins) || 0));
  if (binCount <= 0) return null;
  const bundleType = String(tier.bundle ?? "individual");
  const bundlePrice = Number(tier.price) || 0;
  const subtotalPreTax = bundlePrice;
  const hst = Math.round(subtotalPreTax * HST_RATE * 100) / 100;
  const total = Math.round((subtotalPreTax + hst) * 100) / 100;

  const dropOff = (scheduledDate ?? "").slice(0, 10);
  if (!dropOff) return null; // no move date to anchor the rental window
  const pickup = addDaysISO(dropOff, DEFAULT_RENTAL_DAYS);

  const delivery = (fromAddress ?? "").trim();

  const buildPayload = (orderNumber: string) => ({
    order_number: orderNumber,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone || "",
    delivery_address: delivery,
    delivery_access: (fromAccess as string) || "elevator",
    delivery_notes: `Added from move ${moveCode} (bin rental add-on). Confirm the drop-off date; pickup auto-sets to ${DEFAULT_RENTAL_DAYS} days after.`,
    pickup_address: null,
    bundle_type: bundleType,
    bin_count: binCount,
    includes_paper: false,
    includes_zip_ties: true,
    move_date: dropOff,
    drop_off_date: dropOff,
    pickup_date: pickup,
    status: "confirmed",
    bundle_price: bundlePrice,
    delivery_surcharge: 0,
    late_return_fees: 0,
    subtotal: subtotalPreTax,
    hst,
    total,
    // Billed on the move, not separately. Marked paid so it never shows a
    // spurious balance; source distinguishes it from standalone bin bookings.
    square_payment_id: opts.squarePaymentId ?? null,
    square_customer_id: opts.squareCustomerId ?? null,
    square_card_id: opts.squareCardId ?? null,
    payment_status: "paid",
    paid_total_cents: Math.round(total * 100),
    move_id: moveId,
    source: "move_addon",
  });

  let row: { id: string; order_number: string } | null = null;
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = await supabase
      .from("bin_orders")
      .select("id", { count: "exact", head: true });
    const seq = (count ?? 0) + 1 + attempt;
    const orderNumber = `BIN-${String(seq).padStart(4, "0")}`;

    const { data, error } = await supabase
      .from("bin_orders")
      .insert(buildPayload(orderNumber))
      .select("id, order_number")
      .single();

    if (data && !error) {
      row = data;
      break;
    }
    lastError = error;
    if (error?.code !== "23505") break; // only retry on order_number collision
  }

  if (!row) {
    console.error("[createBinOrderFromMoveAddon] insert failed:", lastError);
    return null;
  }
  return { orderId: row.id, orderNumber: row.order_number };
}
