/**
 * Square invoice field builders — structured titles, IDs, line items, and the
 * payment-instructions message that goes onto every B2B / PM invoice.
 *
 * These helpers replace the ad-hoc strings that used to live inside
 * createAndPublishSquareInvoice. The goal is institutional-grade output:
 * the title tells you what / when / where, the invoice ID is human-readable
 * and tied to the job number, and the message contains the full payment
 * options (e-transfer, credit card, EFT/direct deposit) every time.
 *
 * Partner-type routing is loose on purpose — we accept any vertical string
 * (e.g. "property_management_residential", "furniture_retailer", legacy
 * "retail") and match by substring so callers don't need to normalize.
 */

export type InvoicePartnerVertical = string | null | undefined;

export type InvoiceLineMove = {
  move_code?: string | null;
  scheduled_date?: string | null;
  completed_at?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  delivery_address?: string | null;
  unit_number?: string | null;
  tenant_name?: string | null;
  client_name?: string | null;
  pm_move_kind?: string | null;
  pm_reason_code?: string | null;
  service_type?: string | null;
  is_pm_move?: boolean | null;
  /** B2B vertical code from the source quote's factors_applied — drives
   *  the "Furniture / Flooring / Cabinetry Delivery" label on the line
   *  item and the corresponding wording in the invoice title. */
  b2b_vertical_code?: string | null;
  /** Per-item breakdown from the source quote (also factors_applied).
   *  Rendered into the line-item note so the client sees exactly what
   *  we delivered — Chatlani no longer has to open the source quote to
   *  reconcile a Square invoice. */
  b2b_line_items?: Array<{
    description?: string | null;
    quantity?: number | string | null;
  }> | null;
  /** Business name when the invoice is billed to a company AND we still
   *  want the individual contact's name on the note. */
  company_name?: string | null;
};

/** Short destination string for a title / line item — first comma-separated
 *  segment of the delivery address, or null when nothing usable is set.
 *  "54 Gentile Circle, Vaughan, ON L4K 4J4" → "54 Gentile Circle". */
export function destinationShort(
  address: string | null | undefined,
): string | null {
  const raw = String(address ?? "").trim();
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

/** Map a B2B vertical code (or a bare white-glove service) to the label
 *  we use as the delivery-service prefix. Falls back to "White Glove"
 *  per operator direction — a premium term that reads correctly on any
 *  vertical we haven't explicitly mapped yet. */
export function verticalDeliveryLabel(
  vertical: string | null | undefined,
): string {
  const v = String(vertical ?? "").toLowerCase();
  if (v.includes("furniture") || v === "retail" || v === "furniture_retailer") return "Furniture";
  if (v.includes("floor")) return "Flooring";
  if (v.includes("appliance")) return "Appliance";
  if (v.includes("cabinet")) return "Cabinetry";
  if (v.includes("art") || v.includes("gallery")) return "Art";
  if (v === "interior_designer" || v === "designer" || v.includes("design")) return "Interior Design";
  if (v.includes("kitchen") || v.includes("bath")) return "Kitchen & Bath";
  if (v.includes("lighting")) return "Lighting";
  if (v.includes("mattress") || v.includes("bedding")) return "Mattress";
  if (v.includes("home_goods") || v.includes("homegoods")) return "Home Goods";
  return "White Glove";
}

/* ─────────────────────────  TITLE  ───────────────────────── */

export type BuildInvoiceTitleInput = {
  /** Organization vertical / type (e.g. "property_management_residential"). */
  partnerVertical: InvoicePartnerVertical;
  /** Org name — used as a last-resort fallback when nothing else is set. */
  partnerName?: string | null;
  /** Building / property full address; only the street name is shown. */
  buildingName?: string | null;
  /** When the invoice covers a date range, both ends. Single-job invoices may
   *  leave end null (= same as start). */
  billingPeriodStart: Date;
  billingPeriodEnd?: Date | null;
  /** Number of moves rolled into this invoice (1 for single-job). */
  moveCount: number;
  isSingleJob: boolean;
  /** When isSingleJob, the move code (e.g. "MV-30205"). */
  moveCode?: string | null;
  /** Single-job delivery address — surfaces on the title as the destination
   *  street so the invoice self-identifies without opening it. Ignored on
   *  consolidated (multi-job) invoices, where a period is more useful. */
  deliveryAddress?: string | null;
  /** Service type of the underlying job. Used only when this is a single
   *  white-glove residential delivery (falls outside the B2B vertical map)
   *  so the title reads "White Glove Delivery Services · …" rather than
   *  the generic fallback. */
  serviceType?: string | null;
};

/** Lowercased vertical check that tolerates legacy slugs ("retail", "designer"). */
function verticalIncludes(
  vertical: InvoicePartnerVertical,
  fragment: string,
): boolean {
  return (vertical || "").toLowerCase().includes(fragment);
}

function isPropertyManagement(v: InvoicePartnerVertical): boolean {
  const s = (v || "").toLowerCase();
  return (
    s.includes("property_management") ||
    s === "property_manager" ||
    s === "developer_builder"
  );
}

function isFurnitureRetail(v: InvoicePartnerVertical): boolean {
  const s = (v || "").toLowerCase();
  return s.includes("furniture") || s === "retail" || s === "furniture_retailer";
}

function isInteriorDesigner(v: InvoicePartnerVertical): boolean {
  const s = (v || "").toLowerCase();
  return s === "interior_designer" || s === "designer";
}

export function buildInvoiceTitle(input: BuildInvoiceTitleInput): string {
  const end = input.billingPeriodEnd ?? input.billingPeriodStart;
  const period = formatBillingPeriod(input.billingPeriodStart, end);

  // Property management stays untouched — separate template, operator
  // approved as-is.
  if (isPropertyManagement(input.partnerVertical) && !input.isSingleJob) {
    const building = input.buildingName
      ? ` · ${formatBuildingShortName(input.buildingName)}`
      : "";
    return `Residential Relocation Services · ${period}${building}`;
  }
  if (isPropertyManagement(input.partnerVertical) && input.isSingleJob) {
    const ref = (input.moveCode || "").trim();
    const single = formatMonthDay(input.billingPeriodStart);
    return ref
      ? `Residential Relocation · ${ref} · ${single}`
      : `Residential Relocation · ${single}`;
  }

  // Single-job B2B / white-glove: service label + destination street.
  // No date — the destination is more useful (Chatlani reads "54 Gentile
  // Circle" and knows exactly which invoice this is without opening it).
  if (input.isSingleJob) {
    const destination = destinationShort(input.deliveryAddress);
    const svc = String(input.serviceType ?? "").toLowerCase();
    // White-glove residential delivery — always the "White Glove"
    // prefix regardless of vertical, matches how those jobs are sold.
    const label =
      svc === "white_glove"
        ? "White Glove"
        : verticalDeliveryLabel(input.partnerVertical);
    const base = `${label} Delivery Services`;
    return destination ? `${base} · ${destination}` : base;
  }

  // Consolidated (multi-job) B2B / white-glove: label + billing period.
  // The period is meaningful across jobs; individual destinations aren't.
  const label = verticalDeliveryLabel(input.partnerVertical);
  return `${label} Delivery Services · ${period}`;
}

/* ─────────────────────────  INVOICE ID  ───────────────────────── */

export type BuildInvoiceIdInput = {
  isSingleJob: boolean;
  /** Move code (e.g. "MV-30205") — required when isSingleJob = true. */
  moveCode?: string | null;
  /** Delivery number (e.g. "DLV-2042") — used for single-job delivery invoices
   *  when no moveCode is provided. */
  deliveryNumber?: string | null;
  /** Billing date used for the date-stamped portion of consolidated IDs. */
  billingDate: Date;
  /** Sequence number for consolidated invoices on the same day (default 1). */
  invoiceSequence?: number;
};

/**
 * Structured invoice ID. Single-job invoices reuse the job number directly
 * (`INV-30205` from `MV-30205`); consolidated invoices use a date + sequence
 * (`INV-20260516-01`). Square caps `invoiceNumber` to 191 chars; ours stay
 * well under that.
 */
export function buildInvoiceId(input: BuildInvoiceIdInput): string {
  if (input.isSingleJob) {
    const ref = (input.moveCode || input.deliveryNumber || "").trim();
    if (ref) {
      // MV-30205 → 30205, DLV-2042 → 2042
      const stripped = ref.replace(/^[A-Z]+-/i, "");
      return `INV-${stripped}`.slice(0, 64);
    }
  }
  const dateStr = isoYmd(input.billingDate).replace(/-/g, "");
  const seq = String(Math.max(1, input.invoiceSequence || 1)).padStart(2, "0");
  return `INV-${dateStr}-${seq}`;
}

/* ─────────────────────────  MESSAGE  ───────────────────────── */

export type BillingContact = {
  etransferEmail: string;
  billingEmail: string;
  bankName: string;
  bankAccount: string;
  bankTransit: string;
  bankInstitution: string;
  officeAddress: string;
  creditCardFeePct: string;
  hstRegistration: string;
};

/**
 * Default billing contact (matches platform_config defaults). Callers that
 * have already loaded platform_config should pass their own values instead
 * of relying on these — that's the path that goes to production.
 */
export const DEFAULT_BILLING_CONTACT: BillingContact = {
  etransferEmail: "pay@helloyugo.com",
  billingEmail: "billing@helloyugo.com",
  bankName: "RBC Royal Bank",
  bankAccount: "1013408",
  bankTransit: "02074",
  bankInstitution: "003",
  officeAddress: "507 King Street East, Toronto, ON M5A 1M3",
  creditCardFeePct: "3.5",
  hstRegistration: "777054038 RT0001",
};

export function buildInvoiceMessage(input: {
  moveCount: number;
  billingPeriod: string;
  isSingleJob: boolean;
  moveCode?: string | null;
  contact?: BillingContact;
  /** "delivery" for B2B / white-glove invoices, "move" for residential /
   *  PM. Drives the noun in the scope sentence so a B2B client never
   *  reads "1 move completed" on a Furniture Delivery invoice. Defaults
   *  to "job" — noun-neutral fallback that reads correctly on anything. */
  jobNoun?: "delivery" | "move" | "job";
}): string {
  const c = input.contact ?? DEFAULT_BILLING_CONTACT;
  const noun = input.jobNoun ?? "job";
  const nounPlural =
    noun === "delivery" ? "deliveries" : `${noun}s`;
  const scope =
    input.isSingleJob && input.moveCode
      ? `This invoice covers services rendered for ${noun} ${input.moveCode}.`
      : `This invoice covers ${input.moveCount} ${
          input.moveCount === 1 ? noun : nounPlural
        } completed during the period ${input.billingPeriod}.`;

  const body = [
    "Thank you for your business with Yugo.",
    "",
    "PAYMENT OPTIONS",
    "",
    "E-Transfer",
    `Send to: ${c.etransferEmail}`,
    "Please include the invoice number in the memo field.",
    "",
    "Credit Card",
    "Accepted via the payment link above.",
    `Note: A ${c.creditCardFeePct}% processing fee applies to credit card payments.`,
    "",
    "EFT / Direct Deposit",
    "Company: HelloYugo Inc.",
    `Bank: ${c.bankName}`,
    `Account Number: ${c.bankAccount}`,
    `Transit Number: ${c.bankTransit}`,
    `Institution Number: ${c.bankInstitution}`,
    `Address: ${c.officeAddress}`,
    "",
    `Please notify us at ${c.billingEmail} once payment has been sent.`,
    "",
    "For questions regarding this invoice, contact your account coordinator or reply to this email.",
  ].join("\n");

  return `${scope}\n\n${body}`;
}

/* ─────────────────────────  LINE ITEMS  ───────────────────────── */

export type BuildLineItemDescriptionInput = {
  move: InvoiceLineMove;
  /** When the invoice covers more than one move, the move code is suffixed on a
   *  newline so the line item self-identifies in Square's email view. */
  includeMoveCodeSuffix?: boolean;
};

export function buildLineItemDescription(
  input: BuildLineItemDescriptionInput,
): string {
  const move = input.move;
  const dateIso = move.scheduled_date || move.completed_at || null;
  const date = dateIso ? formatMonthDay(new Date(dateIso)) : null;
  const unit = (move.unit_number || "").trim();
  const tenant = (move.tenant_name || move.client_name || "").trim();
  const code = (move.move_code || "").trim();

  let description: string;

  if (move.is_pm_move) {
    // Map the PM kind to a human label. Codes like "move_in" / "move_out" /
    // "internal_transfer" / "holding_unit_*" are the common ones; anything
    // unknown gets humanized from the slug.
    const kind = (move.pm_move_kind || move.pm_reason_code || "")
      .trim()
      .toLowerCase();
    const isHolding = kind.includes("hold");
    const isTransfer =
      kind.includes("transfer") ||
      kind.includes("internal") ||
      kind.includes("suite_transfer");
    const isMoveIn = kind.includes("move_in") || kind.includes("movein");
    const isMoveOut = kind.includes("move_out") || kind.includes("moveout");

    let action: string;
    if (isHolding && isMoveIn) action = "Move-In via Holding Unit";
    else if (isHolding && isMoveOut) action = "Move-Out to Holding Unit";
    else if (isHolding) action = "Holding Unit Transfer";
    else if (isTransfer) action = "Suite Transfer";
    else if (isMoveIn) action = "Move-In";
    else if (isMoveOut) action = "Move-Out";
    else action = humanizeSlug(kind) || "Residential Relocation";

    description = unit ? `${action} — Unit ${unit}` : action;
    if (tenant) description += ` · ${tenant}`;
    if (date) description += ` · ${date}`;
  } else if (
    move.service_type === "b2b_delivery" ||
    move.service_type === "white_glove" ||
    move.service_type === "b2b_oneoff"
  ) {
    const destination =
      destinationShort(move.to_address || move.delivery_address) || "Delivery";
    // White-glove always reads "White Glove Delivery" regardless of
    // vertical; other B2B jobs pick their label from the vertical
    // on the source quote (Furniture / Flooring / Cabinetry / …).
    const label =
      move.service_type === "white_glove"
        ? "White Glove Delivery"
        : `${verticalDeliveryLabel(move.b2b_vertical_code)} Delivery`;
    description = `${label} — ${destination}`;
    if (date) description += ` · ${date}`;
  } else {
    const label = humanizeSlug(move.service_type) || "Move Service";
    description = label;
    if (date) description += ` · ${date}`;
  }

  if (input.includeMoveCodeSuffix && code) {
    description += `\n${code}`;
  }
  return description;
}

function b2bServiceLabel(serviceType: string | null | undefined): string {
  const s = (serviceType || "").toLowerCase();
  if (s === "white_glove") return "White Glove Delivery";
  if (s === "b2b_delivery") return "B2B Delivery";
  if (s === "b2b_oneoff") return "B2B Delivery";
  return "Delivery";
}

/** Rich per-line note for Square's `note` field. The line-item name
 *  already carries the label + destination; this note surfaces the
 *  client, both endpoints, per-item breakdown, and the job reference
 *  so the client (Chatlani et al.) can reconcile an invoice line
 *  against the source quote without opening it. Kept to plain text —
 *  Square renders `note` as flowing text on the emailed invoice. */
export function buildLineItemNote(move: InvoiceLineMove): string {
  const lines: string[] = [];

  // Client / company line
  const clientName = String(move.client_name ?? "").trim();
  const companyName = String(move.company_name ?? "").trim();
  if (clientName && companyName && clientName.toLowerCase() !== companyName.toLowerCase()) {
    lines.push(`Client: ${clientName} · ${companyName}`);
  } else if (companyName) {
    lines.push(`Client: ${companyName}`);
  } else if (clientName) {
    lines.push(`Client: ${clientName}`);
  }

  // Route
  const from = String(move.from_address ?? "").trim();
  const to = String(move.to_address ?? move.delivery_address ?? "").trim();
  if (from) lines.push(`Pickup: ${from}`);
  if (to) lines.push(`Drop-off: ${to}`);

  // Item breakdown from the source quote's b2b_line_items
  const items = Array.isArray(move.b2b_line_items) ? move.b2b_line_items : [];
  const formattedItems = items
    .map((row) => {
      const desc = String(row?.description ?? "").trim();
      if (!desc) return null;
      const qtyRaw = row?.quantity ?? 1;
      const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw) || 1;
      return qty > 1 ? `${qty}× ${desc}` : desc;
    })
    .filter((s): s is string => Boolean(s));
  if (formattedItems.length > 0) {
    lines.push(`Items: ${formattedItems.join(", ")}`);
    const totalQty = items.reduce((sum, row) => {
      const qtyRaw = row?.quantity ?? 1;
      const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw) || 1;
      return sum + Math.max(1, qty);
    }, 0);
    if (totalQty > formattedItems.length) {
      lines.push(`Total quantity: ${totalQty}`);
    }
  }

  // Job reference — always last so it's easy to scan for
  const code = String(move.move_code ?? "").trim();
  if (code) lines.push(`Job ref: ${code}`);

  return lines.join("\n");
}

/* ─────────────────────────  HST LINE ITEM  ───────────────────────── */

export function buildHstLineItemName(subtotal: number): string {
  return `HST (13%) — on $${formatCurrency(subtotal)} subtotal`;
}

export function buildHstLineItemNote(hstRegistration: string): string {
  return `HST Registration: ${hstRegistration}`;
}

/* ─────────────────────────  REMINDERS  ───────────────────────── */

export function buildPaymentReminders(input: {
  invoiceId: string;
  partnerName: string;
  billingEmail: string;
}): { relativeScheduledDays: number; message: string }[] {
  const { invoiceId, partnerName, billingEmail } = input;
  return [
    {
      relativeScheduledDays: -7,
      message: `Reminder: Invoice ${invoiceId} for ${partnerName} is due in 7 days.`,
    },
    {
      relativeScheduledDays: -3,
      message: `Reminder: Invoice ${invoiceId} is due in 3 days. Pay at the link above or contact ${billingEmail}.`,
    },
    {
      relativeScheduledDays: 1,
      message: `Invoice ${invoiceId} is now overdue. Please remit payment as soon as possible or contact us at ${billingEmail}.`,
    },
  ];
}

/* ─────────────────────────  FORMATTERS  ───────────────────────── */

export function formatBillingPeriod(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-CA", { month: "long" });
  const endMonth = end.toLocaleDateString("en-CA", { month: "long" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    startDay === endDay;

  if (sameDay) {
    return `${startMonth} ${startDay}, ${year}`;
  }
  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

export function formatBuildingShortName(address: string): string {
  // "1376 Credit Woodlands Court, Mississauga, ON L5C 3J5" → "Credit Woodlands Court"
  const head = (address.split(",")[0] || "").trim();
  if (!head) return "";
  const words = head.split(/\s+/);
  if (words.length > 1 && /^\d+[A-Za-z]?$/.test(words[0])) {
    return words.slice(1).join(" ");
  }
  return head;
}

export function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isoYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function humanizeSlug(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatCurrency(n: number): string {
  // Coerce -0 (and sub-cent float artifacts) to +0 so callers that prepend
  // "$" can't emit "$-0.00" on an invoice line.
  const safe = (Math.round(n * 100) + 0) / 100;
  return safe.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
