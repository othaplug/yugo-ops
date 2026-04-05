import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import { buildPmPortalPreviewSample } from "@/lib/partner-pm-portal-preview-data";
import PartnerLightTheme from "../PartnerLightTheme";
import PartnerPropertyManagementPortal from "../PartnerPropertyManagementPortal";

export const metadata: Metadata = {
  title: "Partner PM portal (sample)",
  robots: { index: false, follow: false },
};

function PmPreviewBanner() {
  return (
    <div
      className="shrink-0 z-40 text-center text-[12px] sm:text-[13px] font-semibold py-2.5 px-3 sm:px-4 border-b leading-snug bg-[#FAF7F2]/98 border-[#2C3E2D]/18 text-[#2C3E2D]"
      role="status"
    >
      Sample UI — static data.{" "}
      <span className="text-[#2C3E2D]/70 font-normal">
        Open{" "}
        <code className="text-[11px] font-mono bg-[#2C3E2D]/8 px-1 py-0.5 rounded">
          /partner
        </code>{" "}
        after sign-in for your real portal.
      </span>
    </div>
  );
}

/** Property-management partner shell (Overview / Programs) with mock data. */
export default function PartnerPmPortalPreviewPage() {
  if (!allowClientUiPreview()) notFound();

  const initialSummary = buildPmPortalPreviewSample();

  return (
    <>
      <PartnerLightTheme />
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
        <PmPreviewBanner />
        <div className="flex-1 min-h-0">
          <PartnerPropertyManagementPortal
            orgId="00000000-0000-4000-8000-000000000001"
            orgName="Sample Property Group"
            contactName="Alex"
            preview={{
              initialSummary,
              initialPrograms: initialSummary.projects,
            }}
          />
        </div>
      </div>
    </>
  );
}
