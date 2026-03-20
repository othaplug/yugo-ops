import NewClientForm from "../../clients/new/NewClientForm";
import BackButton from "../../components/BackButton";

export const metadata = { title: "New Partner" };

export default function NewPartnerPage() {
  return (
    <div className="max-w-[600px] mx-auto px-5 md:px-6 py-5">
      <BackButton label="Back" fallback="/admin/partners" className="mb-3" />
      <h1 className="font-heading text-[18px] font-bold text-[var(--tx)] mb-4">Add Partner</h1>
      <NewClientForm defaultPersona="partner" defaultPartnerType="furniture_retailer" />
    </div>
  );
}
