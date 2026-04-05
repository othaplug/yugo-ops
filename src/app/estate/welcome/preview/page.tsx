import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import EstateWelcomeGuideView from "../EstateWelcomeGuideView";

export const metadata: Metadata = {
  title: "Estate welcome guide (sample)",
  robots: { index: false, follow: false },
};

/** Static sample of the token-based welcome guide (dev or preview env flags). */
export default function EstateWelcomePreviewPage() {
  if (!allowClientUiPreview()) notFound();

  const base = getEmailBaseUrl();
  return (
    <EstateWelcomeGuideView
      moveCode="ESTATE-SAMPLE"
      moveDateLabel="May 15, 2026"
      trackUrl={`${base}/estate/track-preview`}
      coordName="Jordan Chen"
      coordPhone="(647) 555-0100"
      coordEmail="estate@helloyugo.com"
      supportEmail={getClientSupportEmail()}
      clientName="Alex Sample"
      hasScheduledMove
      previewBanner="Sample preview — not tied to a real booking."
    />
  );
}
