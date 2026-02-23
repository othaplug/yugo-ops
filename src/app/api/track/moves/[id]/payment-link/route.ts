import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { SquareClient, SquareEnvironment } from "square";
import { getMoveCode, formatJobId } from "@/lib/move-code";

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

  // Production deploy (NODE_ENV=production) → use Square Production unless explicitly sandbox.
  // Local dev → use Sandbox unless SQUARE_ENVIRONMENT=production.
  const envOverride = (process.env.SQUARE_ENVIRONMENT || "").toLowerCase();
  const useProduction =
    envOverride === "production" || (process.env.NODE_ENV === "production" && envOverride !== "sandbox");
  const squareClient = new SquareClient({
    token: accessToken,
    environment: useProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  try {
    const admin = createAdminClient();
    const { data: move, error: moveError } = await admin
      .from("moves")
      .select("id, estimate, status, client_name, move_code")
      .eq("id", moveId)
      .single();

    if (moveError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const baseDollars =
      move.status === "paid" ? 0 : Number(move.estimate || 0);
    const [changeFeesRes, extraFeesRes] = await Promise.all([
      admin
        .from("move_change_requests")
        .select("fee_cents")
        .eq("move_id", moveId)
        .eq("status", "approved"),
      admin
        .from("extra_items")
        .select("fee_cents")
        .eq("job_id", moveId)
        .eq("job_type", "move")
        .eq("status", "approved"),
    ]);
    const changeFeesCents = (changeFeesRes.data ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
    const extraFeesCents = (extraFeesRes.data ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
    const totalCents =
      Math.round(baseDollars * 100) + changeFeesCents + extraFeesCents;

    if (totalCents <= 0) {
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

    const amountCents = totalCents;
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
      paymentNote: `${formatJobId(getMoveCode(move), "move")}`,
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
