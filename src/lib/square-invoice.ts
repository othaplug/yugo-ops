import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import type { Currency } from "square";
import {
  buildInvoiceId,
  buildInvoiceMessage,
  buildInvoiceTitle,
  buildLineItemDescription,
  buildHstLineItemName,
  buildHstLineItemNote,
  buildPaymentReminders,
  DEFAULT_BILLING_CONTACT,
  formatBillingPeriod,
  type BillingContact,
  type InvoiceLineMove,
  type InvoicePartnerVertical,
} from "@/lib/square-invoice-builders";
import { getInvoiceBillingContact } from "@/lib/square-invoice-config";

/**
 * Per-line input for consolidated invoices. When `lineItems` is provided on
 * CreateSquareInvoiceInput, the helper builds a multi-line Square invoice
 * instead of the single "Move / Delivery" line. The legacy single-job path
 * (no lineItems) is still supported and synthesizes a single line from the
 * top-level fields for backward compatibility.
 */
export type SquareInvoiceLineItem = {
  /** Pre-tax amount in dollars (HST is computed at the invoice level). */
  amount: number;
  move: InvoiceLineMove;
};

export interface CreateSquareInvoiceInput {
  /** Delivery UUID or move UUID — used for Square idempotency keys */
  deliveryId: string;
  /** DLV-xxxx or move code for display */
  deliveryNumber: string;
  customerName: string;
  deliveryAddress: string;
  /** Invoice subtotal in dollars (not cents) — pre-HST. Ignored when
   *  `lineItems` is provided (subtotal is summed from the lines). */
  amount: number;
  orgEmail: string | null;
  orgName: string;
  contactName: string | null;
  /** Invoice due in N days (15 or 30). Default 30. */
  invoiceDueDays?: number;
  /** Invoice due on day of month (15 or 30). If set, overrides invoiceDueDays. */
  invoiceDueDayOfMonth?: number | null;
  currency?: Currency;
  /** Partner B2B move invoice vs delivery invoice (line item + Square copy) */
  jobType?: "delivery" | "move";
  /** Organization vertical (e.g. "property_management_residential",
   *  "furniture_retailer"). Drives title + line-item copy. */
  partnerVertical?: InvoicePartnerVertical;
  /** Building full address — used for the title suffix on consolidated PM
   *  invoices. */
  buildingName?: string | null;
  /** Service period start (defaults to today). */
  billingPeriodStart?: Date | null;
  /** Service period end (defaults to billingPeriodStart). */
  billingPeriodEnd?: Date | null;
  /** Move code (e.g. "MV-30205") — preferred over deliveryNumber when both
   *  exist, to build a "INV-30205" Square invoice number. */
  moveCode?: string | null;
  /** For consolidated PM invoices on the same day, the sequence number. */
  invoiceSequence?: number;
  /** Multi-line invoice (consolidated PM, multi-move batch, etc.). When set,
   *  `amount` is ignored and the subtotal is computed from these lines. */
  lineItems?: SquareInvoiceLineItem[];
  /** Override the billing contact (banking + emails) — defaults to platform_config. */
  billingContact?: BillingContact;
}

export interface CreateSquareInvoiceResult {
  squareInvoiceId: string;
  squareInvoiceUrl: string | null;
  /** The structured INV-… id assigned to the Square invoice. */
  invoiceNumber: string;
}

/**
 * Creates an Order → Invoice → Publishes it via the Square API.
 * Returns null if Square is not configured or the call fails.
 *
 * The invoice is constructed by the helpers in `square-invoice-builders.ts`:
 *   - Title: partner-vertical aware (Residential Relocation Services /
 *     White Glove Delivery / Interior Design Logistics / etc.).
 *   - ID: `INV-30205` for single-job, `INV-YYYYMMDD-NN` for consolidated.
 *   - Message: full payment options (e-transfer, credit card with 3.5% fee
 *     note, EFT / direct deposit with banking details).
 *   - Line items: PM moves render as `Move-In — Unit 1304 · Tenant · May 3, 2026`
 *     with the move code on a second line; B2B as service + destination + date.
 *   - HST line: `HST (13%) — on $X subtotal` with `HST Registration: …` note.
 *   - Customer can save payment method (storePaymentMethodEnabled = true).
 *   - Auto-reminders: -7d, -3d, +1d (overdue).
 */
export async function createAndPublishSquareInvoice(
  input: CreateSquareInvoiceInput,
): Promise<CreateSquareInvoiceResult | null> {
  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) return null;

  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) return null;

  const {
    deliveryId,
    deliveryNumber,
    customerName,
    deliveryAddress,
    amount,
    orgEmail,
    orgName,
    contactName,
    invoiceDueDays = 30,
    invoiceDueDayOfMonth = null,
    currency = "CAD" as Currency,
    jobType = "delivery",
    partnerVertical = null,
    buildingName = null,
    moveCode = null,
    invoiceSequence = 1,
    lineItems,
  } = input;

  const idem = (suffix: string) =>
    jobType === "move"
      ? `${suffix}-move-${deliveryId}`
      : `${suffix}-delivery-${deliveryId}`;

  const dueDateIso = computeDueDateIso({
    invoiceDueDayOfMonth,
    invoiceDueDays,
  });
  const dueDate = new Date(`${dueDateIso}T00:00:00`);

  // Service period for the title + message. Single-job invoices use the move
  // date; consolidated invoices pass an explicit range.
  const billingPeriodStart =
    input.billingPeriodStart ??
    firstDate(lineItems?.map((l) => l.move.scheduled_date ?? l.move.completed_at)) ??
    new Date();
  const billingPeriodEnd =
    input.billingPeriodEnd ??
    lastDate(lineItems?.map((l) => l.move.scheduled_date ?? l.move.completed_at)) ??
    billingPeriodStart;

  const isSingleJob = !lineItems || lineItems.length <= 1;
  const moveCount = lineItems ? lineItems.length : 1;

  const billingContact =
    input.billingContact ?? (await getInvoiceBillingContact());

  const invoiceNumber = buildInvoiceId({
    isSingleJob,
    moveCode: moveCode || (jobType === "move" ? deliveryNumber : null),
    deliveryNumber: jobType === "delivery" ? deliveryNumber : null,
    billingDate: billingPeriodEnd,
    invoiceSequence,
  });

  const title = buildInvoiceTitle({
    partnerVertical,
    partnerName: orgName,
    buildingName,
    billingPeriodStart,
    billingPeriodEnd,
    moveCount,
    isSingleJob,
    moveCode: moveCode || (jobType === "move" ? deliveryNumber : null),
  });

  const billingPeriodLabel = formatBillingPeriod(
    billingPeriodStart,
    billingPeriodEnd,
  );

  const description = buildInvoiceMessage({
    moveCount,
    billingPeriod: billingPeriodLabel,
    isSingleJob,
    moveCode: moveCode || (jobType === "move" ? deliveryNumber : null),
    contact: billingContact,
  });

  try {
    // 1. Find or create a Square Customer
    let squareCustomerId: string | null = null;
    if (orgEmail) {
      try {
        const searchRes = await squareClient.customers.search({
          query: { filter: { emailAddress: { exact: orgEmail } } },
        });
        if (searchRes.customers && searchRes.customers.length > 0) {
          squareCustomerId = searchRes.customers[0].id ?? null;
        }
      } catch {
        // search failed — fall through to create
      }
    }

    if (!squareCustomerId) {
      const displayCompany = (customerName || orgName || "").trim() || "Partner";
      const customerRes = await squareClient.customers.create({
        idempotencyKey: idem("customer"),
        givenName: (contactName || displayCompany).slice(0, 100),
        emailAddress: orgEmail || undefined,
        companyName: displayCompany.slice(0, 255),
      });
      squareCustomerId = customerRes.customer?.id ?? null;
    }

    // 2. Build line items + compute subtotal
    type SquareLineItem = {
      name: string;
      quantity: string;
      basePriceMoney: { amount: bigint; currency: Currency };
      note?: string;
    };

    const orderLines: SquareLineItem[] = [];
    let subtotalCents = 0;

    if (lineItems && lineItems.length > 0) {
      for (const li of lineItems) {
        const cents = Math.round(li.amount * 100);
        subtotalCents += cents;
        const note = buildLineItemDescription({
          move: li.move,
          includeMoveCodeSuffix: false,
        });
        const code = (li.move.move_code || "").trim();
        // Square shows `name` prominently and `note` as a secondary line.
        // Put the descriptive copy in `name` and the move code in `note`.
        orderLines.push({
          name: note,
          quantity: "1",
          basePriceMoney: { amount: BigInt(cents), currency },
          note: code || undefined,
        });
      }
    } else {
      // Legacy single-job path: synthesize one line from the top-level fields.
      subtotalCents = Math.round(amount * 100);
      const note = buildLineItemDescription({
        move: {
          move_code: moveCode || deliveryNumber,
          scheduled_date: billingPeriodStart.toISOString(),
          to_address: deliveryAddress,
          delivery_address: deliveryAddress,
          client_name: customerName,
          service_type: jobType === "move" ? "move" : "b2b_delivery",
        },
      });
      orderLines.push({
        name: note,
        quantity: "1",
        basePriceMoney: { amount: BigInt(subtotalCents), currency },
        note: (moveCode || deliveryNumber || "").trim() || undefined,
      });
    }

    const subtotalDollars = subtotalCents / 100;
    const hstCents = Math.round(subtotalDollars * 0.13 * 100);

    orderLines.push({
      name: buildHstLineItemName(subtotalDollars),
      quantity: "1",
      basePriceMoney: { amount: BigInt(hstCents), currency },
      note: buildHstLineItemNote(billingContact.hstRegistration),
    });

    const orderRes = await squareClient.orders.create({
      order: {
        locationId,
        customerId: squareCustomerId || undefined,
        // HST is already line-itemized; disable Square auto-tax so it doesn't
        // double-apply at the order level.
        pricingOptions: { autoApplyTaxes: false, autoApplyDiscounts: false },
        lineItems: orderLines,
      },
      idempotencyKey: idem("order"),
    });

    const orderId = orderRes.order?.id;
    if (!orderId) {
      console.error("[square-invoice] Order creation returned no orderId");
      return null;
    }

    // 3. Create a Square Invoice
    const reminders = buildPaymentReminders({
      invoiceId: invoiceNumber,
      partnerName: orgName || customerName || "Partner",
      billingEmail: billingContact.billingEmail,
    }).map((r) => ({
      relativeScheduledDays: r.relativeScheduledDays,
      message: r.message.slice(0, 1000),
    }));

    const invoiceRes = await squareClient.invoices.create({
      invoice: {
        orderId,
        locationId,
        primaryRecipient: squareCustomerId
          ? { customerId: squareCustomerId }
          : undefined,
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate: dueDateIso,
            automaticPaymentSource: "NONE",
            reminders,
            tippingEnabled: false,
          },
        ],
        deliveryMethod: orgEmail ? "EMAIL" : "SHARE_MANUALLY",
        invoiceNumber,
        title: title.slice(0, 255),
        // Square renders `description` as the invoice message body — this is
        // where the payment instructions appear.
        description: description.slice(0, 4000),
        // Show the service date on the invoice (matches the title period).
        saleOrServiceDate: dueDate.toISOString().slice(0, 10),
        acceptedPaymentMethods: {
          card: true,
          bankAccount: false,
          squareGiftCard: false,
        },
        // Let customers save card-on-file from the Square-hosted pay page.
        storePaymentMethodEnabled: true,
      },
      idempotencyKey: idem("invoice"),
    });

    const squareInvoice = invoiceRes.invoice;
    if (!squareInvoice?.id) {
      console.error("[square-invoice] Invoice creation returned no id");
      return null;
    }

    // 4. Publish the invoice (sends email if deliveryMethod is EMAIL)
    await squareClient.invoices.publish({
      invoiceId: squareInvoice.id,
      version: squareInvoice.version ?? 0,
      idempotencyKey: idem("publish"),
    });

    return {
      squareInvoiceId: squareInvoice.id,
      squareInvoiceUrl:
        (squareInvoice as { publicUrl?: string }).publicUrl ?? null,
      invoiceNumber,
    };
  } catch (err) {
    console.error("[square-invoice] createAndPublishSquareInvoice failed:", err);
    return null;
  }
}

/* ─────────────────────────  HELPERS  ───────────────────────── */

function computeDueDateIso(input: {
  invoiceDueDayOfMonth: number | null | undefined;
  invoiceDueDays: number;
}): string {
  const now = new Date();
  const dom = input.invoiceDueDayOfMonth;
  if (dom === 15 || dom === 30) {
    let due = new Date(now.getFullYear(), now.getMonth(), dom);
    if (due <= now) {
      due = new Date(now.getFullYear(), now.getMonth() + 1, dom);
    }
    if (dom === 30) {
      const lastDay = new Date(
        due.getFullYear(),
        due.getMonth() + 1,
        0,
      ).getDate();
      due = new Date(due.getFullYear(), due.getMonth(), Math.min(30, lastDay));
    }
    return due.toISOString().slice(0, 10);
  }
  const days = input.invoiceDueDays || 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function firstDate(values: (string | null | undefined)[] | undefined): Date | null {
  if (!values) return null;
  const parsed = values
    .filter((v): v is string => !!v)
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (parsed.length === 0) return null;
  return parsed.reduce((a, b) => (a < b ? a : b));
}

function lastDate(values: (string | null | undefined)[] | undefined): Date | null {
  if (!values) return null;
  const parsed = values
    .filter((v): v is string => !!v)
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (parsed.length === 0) return null;
  return parsed.reduce((a, b) => (a > b ? a : b));
}

// Re-export DEFAULT_BILLING_CONTACT for tests / callers that need it.
export { DEFAULT_BILLING_CONTACT };

/**
 * Best-effort remove a Square invoice before deleting the local row.
 * Draft invoices are deleted; unpaid / scheduled invoices are cancelled (Square does not allow deleting published invoices).
 */
export async function cancelOrDeleteSquareInvoice(
  squareInvoiceId: string | null | undefined,
): Promise<void> {
  const id = (squareInvoiceId || "").trim();
  if (!id || !(process.env.SQUARE_ACCESS_TOKEN || "").trim()) return;

  try {
    const getRes = await squareClient.invoices.get({ invoiceId: id });
    const inv = getRes.invoice;
    if (!inv?.id || inv.version == null) return;
    const status = inv.status;

    if (status === "DRAFT") {
      await squareClient.invoices.delete({ invoiceId: id, version: inv.version });
      return;
    }

    if (
      status === "UNPAID" ||
      status === "PARTIALLY_PAID" ||
      status === "SCHEDULED" ||
      status === "PAYMENT_PENDING"
    ) {
      await squareClient.invoices.cancel({
        invoiceId: id,
        version: inv.version,
      });
    }
  } catch (err) {
    console.error("[square-invoice] cancelOrDeleteSquareInvoice failed:", err);
  }
}
