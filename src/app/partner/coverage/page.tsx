import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PartnerPricingMap from "@/components/maps/PartnerPricingMap";
import { mapOrgVerticalToDeliveryVerticalCode } from "@/lib/maps/vertical-config";
import { CoverageMapPageHeader } from "./CoverageMapPageHeader";

export const dynamic = "force-dynamic";

export default async function PartnerCoveragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const primaryOrgId = partnerRows?.[0]?.org_id;
  if (!primaryOrgId) redirect("/partner/login?error=no_org");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("vertical, type")
    .eq("id", primaryOrgId)
    .single();

  const verticalCode = mapOrgVerticalToDeliveryVerticalCode(
    org?.vertical ?? org?.type,
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-5">
        <Link
          href="/partner"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] hover:text-[#2C3E2D] mb-4"
        >
          <span className="text-[13px] leading-none" aria-hidden>
            ←
          </span>
          Back to partner portal
        </Link>
        <CoverageMapPageHeader />
      </div>

      <PartnerPricingMap
        partnerId={primaryOrgId}
        partnerVertical={verticalCode}
        isAdmin={false}
      />
    </div>
  );
}
