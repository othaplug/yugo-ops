import type { B2BDimensionalQuoteInput } from "@/lib/pricing/b2b-dimensional";
import { synthesizeStopsFromAddresses } from "@/lib/pricing/b2b-dimensional";
import type { StopEntry } from "@/components/ui/MultiStopAddressField";

function pickupDeliveryAddressLists(
  pickupMain: string,
  deliveryMain: string,
  extraPickups: StopEntry[],
  extraDeliveries: StopEntry[],
): { pickups: string[]; drops: string[] } {
  const pickups = [pickupMain, ...extraPickups.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  const drops = [deliveryMain, ...extraDeliveries.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  return { pickups, drops };
}

export function b2bJobsDimensionalStops(
  pickupMain: string,
  deliveryMain: string,
  pickupAccess: string,
  deliveryAccess: string,
  extraPickups: StopEntry[],
  extraDeliveries: StopEntry[],
): B2BDimensionalQuoteInput["stops"] {
  const { pickups, drops } = pickupDeliveryAddressLists(
    pickupMain,
    deliveryMain,
    extraPickups,
    extraDeliveries,
  );
  if (pickups.length >= 1 && drops.length >= 1 && pickups.length + drops.length === 2) {
    return synthesizeStopsFromAddresses(pickups[0]!, drops[0]!, pickupAccess, deliveryAccess);
  }
  if (pickups.length + drops.length < 2) {
    return synthesizeStopsFromAddresses(pickupMain, deliveryMain, pickupAccess, deliveryAccess);
  }
  return [
    ...pickups.map((address) => ({
      type: "pickup" as const,
      address,
      access: pickupAccess.trim() || undefined,
    })),
    ...drops.map((address) => ({
      type: "delivery" as const,
      address,
      access: deliveryAccess.trim() || undefined,
    })),
  ];
}
