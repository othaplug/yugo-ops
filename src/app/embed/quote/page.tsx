import type { Metadata } from "next";
import EmbedQuoteCalculator from "@/components/EmbedQuoteCalculator";

export const metadata: Metadata = {
  title: "Instant Moving Quote, Yugo",
  description: "Get a fast moving estimate from Yugo.",
};

/**
 * Embeddable quote calculator page.
 * Designed to be embedded in Webflow (or any site) via iframe:
 *   <iframe src="https://app.yugomoves.com/embed/quote" width="440" height="620" />
 */
export default function EmbedQuotePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "16px",
        background: "transparent",
      }}
    >
      <EmbedQuoteCalculator fullQuoteUrl={`${process.env.NEXT_PUBLIC_APP_URL || "https://app.yugomoves.com"}/quote-widget`} />
    </div>
  );
}
