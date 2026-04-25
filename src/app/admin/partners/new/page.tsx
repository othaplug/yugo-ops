import NewClientForm from "../../clients/new/NewClientForm";
import BackButton from "../../components/BackButton";
import { resolveVertical } from "@/lib/partner-type";

export const metadata = { title: "New Partner" };

export default async function NewPartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ partnerType?: string }>;
}) {
  const params = await searchParams;
  const partnerType = resolveVertical(params.partnerType || "furniture_retailer");

  return (
    <div className="w-full min-w-0 max-w-[min(600px,100%)] mx-auto py-5">
      <BackButton label="Back" fallback="/admin/partners" className="mb-3" />
      <h1 className="admin-page-hero text-[var(--tx)] mb-4">Add Partner</h1>
      <NewClientForm defaultPersona="partner" defaultPartnerType={partnerType} />
    </div>
  );
}
