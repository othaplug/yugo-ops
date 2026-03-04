import { NextResponse } from "next/server";

/**
 * Returns Square client config (app ID, location ID) for the payment form.
 * Server reads env at runtime so this works even when NEXT_PUBLIC_* aren't
 * inlined on the client (e.g. added after build or wrong prefix in .env).
 */
export async function GET() {
  const appId = (
    process.env.NEXT_PUBLIC_SQUARE_APP_ID ??
    process.env.SQUARE_APP_ID ??
    ""
  ).trim();
  const locationId = (
    process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ??
    process.env.SQUARE_LOCATION_ID ??
    ""
  ).trim();
  const useSandbox =
    process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true" ||
    process.env.SQUARE_USE_SANDBOX === "true";

  if (!appId || !locationId) {
    return NextResponse.json(
      { error: "Square not configured", appId: null, locationId: null },
      { status: 503 }
    );
  }

  return NextResponse.json({ appId, locationId, useSandbox });
}
