import PartnerPricingMap from "@/components/maps/PartnerPricingMap";
import { PricingMapPageHeader } from "./PricingMapPageHeader";

export const metadata = { title: "Pricing map" };
export const dynamic = "force-dynamic";

export default function AdminPricingMapPage() {
  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto">
      <PricingMapPageHeader />

      <PartnerPricingMap isAdmin />
    </div>
  );
}
