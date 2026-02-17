import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { SquareClient, SquareEnvironment } from "square";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Payment is not configured. Please contact support." },
      { status: 503 }
    );
  }

  // Token must match environment: Sandbox token → sandbox, Production token → production.
  // Set SQUARE_ENVIRONMENT=sandbox or production to override (default: production in prod, sandbox in dev).
  const envOverride = (process.env.SQUARE_ENVIRONMENT || "").toLowerCase();
  const useProduction =
    envOverride === "production" || (envOverride !== "sandbox" && process.env.NODE_ENV === "production");
  const squareClient = new SquareClient({
    token: accessToken,
    environment: useProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  try {
    const admin = createAdminClient();
    const { data: move, error: moveError } = await admin
      .from("moves")
      .select("id, estimate, client_name")
      .eq("id", moveId)
      .single();

    if (moveError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const amountDollars = Number(move.estimate || 0);
    if (amountDollars <= 0) {
      return NextResponse.json(
        { error: "No balance due for this move" },
        { status: 400 }
      );
    }

    let locationId = (process.env.SQUARE_LOCATION_ID || "").trim();
    if (!locationId) {
      const listRes = await squareClient.locations.list();
      const list = listRes.locations;
      locationId = list?.[0]?.id || "";
    }
    if (!locationId) {
      return NextResponse.json(
        { error: "Payment location not configured. Please contact support." },
        { status: 503 }
      );
    }

    const amountCents = Math.round(amountDollars * 100);
    const idempotencyKey = `move-${moveId}-${Date.now()}`;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const redirectUrl = baseUrl ? `${baseUrl}/track/move/${moveId}?payment=success` : undefined;

    const createRes = await squareClient.checkout.paymentLinks.create({
      idempotencyKey,
      description: `Move payment – ${move.client_name || moveId}`,
      quickPay: {
        name: "Move balance",
        priceMoney: {
          amount: BigInt(amountCents),
          currency: "CAD",
        },
        locationId,
      },
      paymentNote: `Move ID: ${moveId}`,
      checkoutOptions: redirectUrl ? { redirectUrl } : undefined,
    });

    if (createRes.errors && createRes.errors.length > 0) {
      const first = createRes.errors[0] as { code?: string; message?: string; detail?: string; category?: string };
      console.error("[payment-link] Square API error:", first?.code, first?.message || first?.detail);
      return NextResponse.json(
        { error: "Payment is temporarily unavailable. Please contact us to arrange payment." },
        { status: 502 }
      );
    }

    const url = createRes.paymentLink?.url || (createRes.paymentLink as { longUrl?: string })?.longUrl || null;
    if (!url) {
      console.error("[payment-link] No URL in Square response");
      return NextResponse.json(
        { error: "Payment is temporarily unavailable. Please contact us to arrange payment." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url, paymentUrl: url });
  } catch (err: unknown) {
    console.error("[payment-link]", err);
    return NextResponse.json(
      { error: "Payment is temporarily unavailable. Please contact us to arrange payment." },
      { status: 500 }
    );
  }
}
