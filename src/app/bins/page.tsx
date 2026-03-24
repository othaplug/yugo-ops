export const dynamic = "force-dynamic";

import BinBookingClient from "./BinBookingClient";

export default function BinsPage() {
  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID ?? "";
  const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
  const useSandbox = process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";

  return (
    <BinBookingClient
      squareAppId={squareAppId}
      squareLocationId={squareLocationId}
      useSandbox={useSandbox}
    />
  );
}
