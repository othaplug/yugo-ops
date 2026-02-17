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

  const squareClient = new SquareClient({
    token: accessToken,
    environment:
      process.env.NODE_ENV === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
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

    const createRes = await squareClient.checkout.paymentLinks.create({
      idempotencyKey,
      description: `Move payment – ${move.client_name || moveId}`,
      quickPay: {
        name: "Move balance",
        priceMoney: {
          amount: BigInt(amountCents),
          currency: "USD",
        },
        locationId,
      },
      paymentNote: `Move ID: ${moveId}`,
    });

    if (createRes.errors && createRes.errors.length > 0) {
      const first = createRes.errors[0] as { code?: string; message?: string; detail?: string };
      const msg = first?.message || first?.detail || "Square error";
      const isAuth = first?.code === "UNAUTHORIZED" || (first as { category?: string })?.category === "AUTHENTICATION_ERROR";
      return NextResponse.json(
        { error: isAuth ? "Payment provider authentication failed. Please check Square credentials (token and Sandbox vs Production)." : msg },
        { status: isAuth ? 502 : 502 }
      );
    }

    const url = createRes.paymentLink?.url || (createRes.paymentLink as { longUrl?: string })?.longUrl || null;
    if (!url) {
      return NextResponse.json(
        { error: "Could not create payment link" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (err: unknown) {
    console.error("[payment-link]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create payment link" },
      { status: 500 }
    );
  }
}
