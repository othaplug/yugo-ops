import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { squareClient } from "@/lib/square";

/**
 * POST /api/square/search-customer
 *
 * Body: { email: string }
 *
 * Returns the first Square customer matching the given email, plus their
 * active card-on-file details.  Returns { customer: null } when no match
 * or if Square is unreachable.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ customer: null });
  }

  try {
    const searchRes = await squareClient.customers.search({
      query: {
        filter: {
          emailAddress: { exact: email.trim().toLowerCase() },
        },
      },
    });

    const customers = searchRes.customers;
    if (!customers?.length) return NextResponse.json({ customer: null });

    const customer = customers[0]!;

    // Fetch active card on file (non-critical)
    let activeCard: {
      id: string;
      last4: string;
      cardBrand: string;
    } | null = null;

    try {
      const cardsRes = await squareClient.cards.list({
        customerId: customer.id,
        // SDK omits sortOrder by sending sort_order=null, which serializes to sort_order= and Square rejects (INVALID_ENUM_VALUE).
        sortOrder: "ASC",
      });
      const found = cardsRes.data?.find((c) => c.enabled);
      if (found) {
        activeCard = {
          id: found.id ?? "",
          last4: found.last4 ?? "",
          cardBrand: found.cardBrand ?? "",
        };
      }
    } catch {
      // non-critical
    }

    return NextResponse.json({
      customer: {
        square_id: customer.id ?? "",
        company: customer.companyName ?? "",
        email: customer.emailAddress ?? "",
        phone: customer.phoneNumber ?? "",
        card_on_file: !!activeCard,
        card_last_four: activeCard?.last4 ?? "",
        card_brand: activeCard?.cardBrand ?? "",
        card_id: activeCard?.id ?? "",
      },
    });
  } catch {
    return NextResponse.json({ customer: null });
  }
}
