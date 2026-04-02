import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { SquareClient, SquareEnvironment } from "square";
import { getMoveCode, formatJobId, isMoveIdUuid } from "@/lib/move-code";
import { getSquarePaymentConfig } from "@/lib/square-config";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pathId } = await params;
  let token = req.nextUrl.searchParams.get("token") || "";
  if (!token) {
    try {
      const body = await req.json();
      token = (body?.token ?? "") || "";
    } catch {
      // keep token empty
    }
  }
  if (!token) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Payment is not configured. Please contact support." },
      { status: 503 }
    );
  }

  let locationId: string;
  try {
    const config = await getSquarePaymentConfig();
    locationId = (config.locationId || "").trim();
  } catch (e) {
    console.error("[payment-link] getSquarePaymentConfig failed:", e);
    locationId = (process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION_ID || "").trim();
  }
  if (!locationId) {
    return NextResponse.json(
      { error: "Payment location not configured. Set SQUARE_LOCATION_ID or add square_location_id in Platform Settings." },
      { status: 503 }
    );
  }

  // Production deploy (NODE_ENV=production) → use Square Production unless explicitly sandbox.
  const envOverride = (process.env.SQUARE_ENVIRONMENT || "").toLowerCase();
  const useProduction =
    envOverride === "production" || (process.env.NODE_ENV === "production" && envOverride !== "sandbox");
  const squareClient = new SquareClient({
    token: accessToken,
    environment: useProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  try {
    const admin = createAdminClient();
    const isUuid = isMoveIdUuid(pathId);
    const { data: move, error: moveError } = await admin
      .from("moves")
      .select("id, estimate, status, client_name, move_code")
      .eq(isUuid ? "id" : "move_code", isUuid ? pathId : pathId.replace(/^#/, "").toUpperCase())
      .single();

    if (moveError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (!verifyTrackToken("move", move.id, token)) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    const moveId = move.id;

    const baseDollars = move.status === "paid" ? 0 : Math.max(0, Number(move.estimate ?? 0) || 0);
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
    const totalCents = Math.round(baseDollars * 100) + changeFeesCents + extraFeesCents;

    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return NextResponse.json(
        { error: "No balance due for this move" },
        { status: 400 }
      );
    }

    const amountCents = Math.floor(totalCents);
    const idempotencyKey = `move-${moveId}`;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const redirectUrl = baseUrl ? `${baseUrl}/track/move/${moveId}?payment=success` : undefined;

    let createRes: Awaited<ReturnType<typeof squareClient.checkout.paymentLinks.create>>;
    try {
      createRes = await squareClient.checkout.paymentLinks.create({
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
    } catch (squareErr: unknown) {
      const msg = squareErr instanceof Error ? squareErr.message : String(squareErr);
      console.error("[payment-link] Square createPaymentLink threw:", msg, squareErr);
      return NextResponse.json(
        {
          error: "Payment is temporarily unavailable. Please contact us to arrange payment.",
          code: "SQUARE_ERROR",
          detail: process.env.NODE_ENV === "development" ? msg : undefined,
        },
        { status: 502 }
      );
    }

    if (createRes.errors && createRes.errors.length > 0) {
      const first = createRes.errors[0] as { code?: string; message?: string; detail?: string; category?: string };
      const squareCode = first?.code ?? "UNKNOWN";
      const squareMsg = first?.message || first?.detail || "";
      console.error("[payment-link] Square API error:", squareCode, squareMsg);
      return NextResponse.json(
        {
          error: "Payment is temporarily unavailable. Please contact us to arrange payment.",
          code: squareCode,
          detail: squareMsg,
        },
        { status: 502 }
      );
    }

    const url = createRes.paymentLink?.url || (createRes.paymentLink as { longUrl?: string })?.longUrl || null;
    if (!url) {
      console.error("[payment-link] No URL in Square response");
      return NextResponse.json(
        {
          error: "Payment is temporarily unavailable. Please contact us to arrange payment.",
          code: "NO_PAYMENT_URL",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ url, paymentUrl: url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payment-link] Exception:", message, err);

    if (typeof message === "string" && message.includes("TRACK_SIGNING_SECRET")) {
      return NextResponse.json(
        { error: "Server configuration error. Please contact support.", code: "CONFIG_ERROR" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Payment is temporarily unavailable. Please contact us to arrange payment.",
        code: "SERVER_ERROR",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
