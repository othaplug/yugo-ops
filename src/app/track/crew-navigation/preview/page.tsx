import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import CrewNavPreviewClient from "./CrewNavPreviewClient";

export const metadata: Metadata = {
  title: "Crew navigation (sample)",
  robots: { index: false, follow: false },
};

/** Dev-only sample: full-screen crew Mapbox navigation (no crew login). */
export default function TrackCrewNavigationPreviewPage() {
  if (!allowClientUiPreview()) notFound();
  return <CrewNavPreviewClient />;
}
