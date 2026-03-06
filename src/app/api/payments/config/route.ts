import { NextResponse } from "next/server";
import { getSquarePaymentConfig } from "@/lib/square-config";

export async function GET() {
  try {
    const { appId, locationId } = await getSquarePaymentConfig();
    const useSandbox =
      process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true" ||
      process.env.SQUARE_USE_SANDBOX === "true";

    if (!appId || !locationId) {
      console.error(
        "[payments/config] Square not configured — appId:",
        appId ? "present" : "MISSING",
        "locationId:",
        locationId ? "present" : "MISSING",
        "| env SQUARE_APP_ID:",
        process.env.SQUARE_APP_ID ? "set" : "unset",
        "| env NEXT_PUBLIC_SQUARE_APP_ID:",
        process.env.NEXT_PUBLIC_SQUARE_APP_ID ? "set" : "unset",
        "| env SQUARE_LOCATION_ID:",
        process.env.SQUARE_LOCATION_ID ? "set" : "unset",
        "| env NEXT_PUBLIC_SQUARE_LOCATION_ID:",
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ? "set" : "unset",
      );
      return NextResponse.json(
        { error: "Square not configured", appId: null, locationId: null },
        { status: 503 },
      );
    }

    return NextResponse.json({ appId, locationId, useSandbox });
  } catch (err) {
    console.error("[payments/config] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load payment config" },
      { status: 500 },
    );
  }
}
