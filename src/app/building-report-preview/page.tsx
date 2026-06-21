import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import CrewBuildingReportCard from "@/components/crew/CrewBuildingReportCard";

export const metadata: Metadata = {
  title: "Crew building report (preview)",
  robots: { index: false, follow: false },
};

/** Dev/preview-only harness for the type-aware crew building report card. */
export default function CrewBuildingReportPreviewPage() {
  if (!allowClientUiPreview()) notFound();

  return (
    <div
      style={{
        ["--tx" as string]: "#23201C",
        ["--tx2" as string]: "#5A534A",
        ["--tx3" as string]: "#8A8276",
        ["--brd" as string]: "#E0D8C8",
        background: "#EFE9DD",
        minHeight: "100vh",
        padding: "20px 0",
      }}
    >
      <style>{`.crew-premium-cta{background:#5C1A33;border-radius:12px;}`}</style>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <CrewBuildingReportCard
          moveId="preview"
          fromAddress="8025 Jane Street, Vaughan, ON L4K 2M7"
          toAddress="104 Strathallan Blvd, Toronto, ON M5N 1S7"
        />
      </div>
    </div>
  );
}
