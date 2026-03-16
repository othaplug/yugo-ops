import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { normalizeDeliveryNumber } from "@/lib/delivery-number";
import type { Currency } from "square";

export interface CreateSquareInvoiceInput {
  deliveryId: string;
  deliveryNumber: string;
  customerName: string;
  deliveryAddress: string;
  /** Invoice total in dollars (not cents) */
  amount: number;
  orgEmail: string | null;
  orgName: string;
  contactName: string | null;
  /** Invoice due in N days (15 or 30). Default 30. */
  invoiceDueDays?: number;
  /** Invoice due on day of month (15 or 30). If set, overrides invoiceDueDays. */
  invoiceDueDayOfMonth?: number | null;
  currency?: Currency;
}

export interface CreateSquareInvoiceResult {
  squareInvoiceId: string;
  squareInvoiceUrl: string | null;
}

/**
 * Creates an Order → Invoice → Publishes it via the Square API.
 * Returns null if Square is not configured or the call fails.
 */
export async function createAndPublishSquareInvoice(
  input: CreateSquareInvoiceInput
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
  } = input;

  const dueDate = (() => {
    const now = new Date();
    if (invoiceDueDayOfMonth === 15 || invoiceDueDayOfMonth === 30) {
      const day = invoiceDueDayOfMonth;
      let due = new Date(now.getFullYear(), now.getMonth(), day);
      if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, day);
      if (day === 30) {
        const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        due = new Date(due.getFullYear(), due.getMonth(), Math.min(30, lastDay));
      }
      return due.toISOString().slice(0, 10);
    }
    const d = new Date(now.getTime() + (invoiceDueDays || 30) * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  })();

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
      const customerRes = await squareClient.customers.create({
        idempotencyKey: `customer-delivery-${deliveryId}`,
        givenName: contactName || orgName || customerName,
        emailAddress: orgEmail || undefined,
        companyName: orgName || undefined,
      });
      squareCustomerId = customerRes.customer?.id ?? null;
    }

    // 2. Create a Square Order — subtotal + 13% HST (B2B invoices)
    const subtotalCents = Math.round(amount * 100);
    const hstCents = Math.round(amount * 0.13 * 100);
    const orderRes = await squareClient.orders.create({
      order: {
        locationId,
        customerId: squareCustomerId || undefined,
        lineItems: [
          {
            name: `Delivery ${deliveryNumber}`,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(subtotalCents),
              currency,
            },
            note: deliveryAddress || undefined,
          },
          {
            name: "HST (13%)",
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(hstCents),
              currency,
            },
          },
        ],
      },
      idempotencyKey: `order-delivery-${deliveryId}`,
    });

    const orderId = orderRes.order?.id;
    if (!orderId) {
      console.error("[square-invoice] Order creation returned no orderId");
      return null;
    }

    // 3. Create a Square Invoice
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
            dueDate,
            automaticPaymentSource: "NONE",
          },
        ],
        deliveryMethod: orgEmail ? "EMAIL" : "SHARE_MANUALLY",
        invoiceNumber: normalizeDeliveryNumber(deliveryNumber),
        title: "Delivery Service",
        description: `Delivery for ${customerName} — ${deliveryAddress}`,
        acceptedPaymentMethods: {
          card: true,
          bankAccount: false,
          squareGiftCard: false,
        },
      },
      idempotencyKey: `invoice-delivery-${deliveryId}`,
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
      idempotencyKey: `publish-delivery-${deliveryId}`,
    });

    return {
      squareInvoiceId: squareInvoice.id,
      squareInvoiceUrl: (squareInvoice as { publicUrl?: string }).publicUrl ?? null,
    };
  } catch (err) {
    console.error("[square-invoice] createAndPublishSquareInvoice failed:", err);
    return null;
  }
}
