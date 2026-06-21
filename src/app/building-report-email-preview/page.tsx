import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import { buildingProfileCrewReportAdminEmailHtml } from "@/lib/email/admin-templates";

export const metadata: Metadata = {
  title: "Building report email (preview)",
  robots: { index: false, follow: false },
};

export default function BuildingReportEmailPreviewPage() {
  if (!allowClientUiPreview()) notFound();

  const html = buildingProfileCrewReportAdminEmailHtml({
    isUpdate: false,
    address: "104 Strathallan Blvd, Toronto, ON M5N 1S7",
    buildingProfileId: "preview",
    complexityRating: 4,
    elevatorSystemKey: "standard",
    estimatedExtraMinutesPerTrip: 7,
    accessSummaryLines: ["Long carry from dock or elevator", "COI required by building management", "Elevator booking required (120 min window)"],
    buildingType: "high_rise",
    accessArchetype: "elevator",
    crewNotes: "Freight at P1, fob from concierge, long carts ok.",
    photoCount: 0,
    timesReportedByCrew: 2,
    moveCode: "MV-30248",
    clientName: "Kemal Ozbek",
    fromAddress: "8025 Jane Street, Vaughan, ON L4K 2M7",
    toAddress: "104 Strathallan Blvd, Toronto, ON M5N 1S7",
    partnerOrgName: "Kemal Ozbek",
    partnerOrgType: "b2c",
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
