import Link from "next/link";
import NewClientForm from "./NewClientForm";
import { isReferralHubOrgVertical } from "@/lib/partner-type";

export const metadata = { title: "New Client" };

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; partnerType?: string; referralHub?: string }>;
}) {
  const params = await searchParams;
  const isPartner = params.type === "partner";
  const partnerType = params.partnerType || "furniture_retailer";
  const referralPartnerHub =
    isPartner && (params.referralHub === "1" || isReferralHubOrgVertical(partnerType));

  const pageTitle = !isPartner
    ? "Add Client"
    : referralPartnerHub
      ? "Add Referral Partner"
      : "Add Partner";

  return (
    <div className="max-w-[600px] mx-auto px-5 md:px-6 py-5">
      <Link
        href={referralPartnerHub ? "/admin/partners/realtors" : "/admin/clients"}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3"
      >
        ← Back
      </Link>
      <h1 className="admin-page-hero text-[var(--tx)] mb-4">{pageTitle}</h1>
      <NewClientForm
        defaultPersona={isPartner ? "partner" : "client"}
        defaultPartnerType={partnerType}
        referralPartnerHub={referralPartnerHub}
      />
    </div>
  );
}