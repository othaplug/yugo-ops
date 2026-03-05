import { NextResponse } from "next/server";
import { getSquarePaymentConfig } from "@/lib/square-config";

/**
 * Returns Square client config (app ID, location ID) for the payment form.
 * Uses getSquarePaymentConfig (env then platform_config).
 */
export async function GET() {
  const { appId, locationId } = await getSquarePaymentConfig();
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
