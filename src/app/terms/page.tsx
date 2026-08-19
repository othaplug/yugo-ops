import type { Metadata } from "next";
import YugoLogo from "@/components/YugoLogo";
import {
  B2B_TERMS_FULL,
  B2B_TERMS_DISCLAIMER,
} from "@/lib/quotes/b2b-coverage-and-terms";

/* Brand tokens sourced from the client quote pages (src/lib/client-theme.ts /
   quote-shared.ts) so this legal page reads as one system with the quote flow. */
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const CREAM = "#FAF7F2";
const INK_BODY = "#3A3A38"; // comfortable reading ink on cream
const INK_MUTED = "#5A554F"; // captions / disclaimer

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Commercial Terms" };
}

export default function TermsPage() {
  return (
    <main
      className="min-h-screen w-full"
      style={{ backgroundColor: CREAM, color: INK_BODY }}
    >
      <div className="mx-auto w-full max-w-[720px] px-6 sm:px-8 py-16 sm:py-24">
        {/* Header */}
        <header className="text-center">
          <div className="flex justify-center mb-6">
            <YugoLogo size={26} variant="wine" onLightBackground />
          </div>
          <div
            className="w-12 h-px mx-auto mb-8"
            style={{ backgroundColor: `${FOREST}55` }}
          />
          <p
            className="text-[11px] font-bold tracking-[0.16em] uppercase mb-4"
            style={{ color: FOREST }}
          >
            For Business Clients
          </p>
          <h1
            className="font-hero font-bold leading-[1.08] text-[34px] sm:text-[44px]"
            style={{ color: WINE }}
          >
            Commercial Terms &amp; Conditions
          </h1>
          <p
            className="mt-5 text-[15px] leading-relaxed"
            style={{ color: INK_MUTED }}
          >
            The agreement that governs every Yugo commercial delivery, reviewed
            before you book.
          </p>
        </header>

        <div
          className="w-full h-px my-12 sm:my-14"
          style={{ backgroundColor: `${FOREST}20` }}
        />

        {/* Sections */}
        <div className="space-y-11 sm:space-y-12">
          {B2B_TERMS_FULL.map((section) => (
            <section key={section.heading}>
              <h2
                className="font-hero font-bold leading-snug text-[21px] sm:text-[23px] mb-4"
                style={{ color: WINE }}
              >
                {section.heading}
              </h2>
              <div className="space-y-4">
                {section.body.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[15px] leading-[1.75]"
                    style={{ color: INK_BODY }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          className="mt-14 sm:mt-16 border px-5 py-5 sm:px-6 sm:py-6"
          style={{
            borderColor: `${FOREST}26`,
            backgroundColor: "#FFFCFB",
          }}
        >
          <p
            className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2"
            style={{ color: FOREST }}
          >
            Please Note
          </p>
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: INK_MUTED }}
          >
            {B2B_TERMS_DISCLAIMER}
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <div
            className="w-12 h-px mx-auto mb-6"
            style={{ backgroundColor: `${FOREST}30` }}
          />
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: INK_MUTED }}
          >
            Yugo Technologies Inc.
          </p>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: INK_MUTED }}
          >
            Questions about these terms? Reach us at{" "}
            <a
              href="mailto:info@helloyugo.com"
              className="underline underline-offset-2"
              style={{ color: WINE }}
            >
              info@helloyugo.com
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
