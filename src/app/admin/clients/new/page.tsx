import Link from "next/link";
import NewClientForm from "./NewClientForm";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; partnerType?: string }>;
}) {
  const params = await searchParams;
  const isPartner = params.type === "partner";
  const partnerType = params.partnerType || "retail";
  const pageTitle = isPartner ? "Add Partner" : "Add Client";

  return (
    <div className="max-w-[600px] mx-auto px-5 md:px-6 py-5">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3">
        ← Back
      </Link>
      <h1 className="font-heading text-[18px] font-bold text-[var(--tx)] mb-4">{pageTitle}</h1>
      <NewClientForm defaultPersona={isPartner ? "partner" : "client"} defaultPartnerType={partnerType} />
    </div>
  );
}