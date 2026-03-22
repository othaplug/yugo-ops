"use client";

import YugoLogo from "@/components/YugoLogo";

export default function QuoteExpired({
  quoteId,
  reason,
  expiresAt,
}: {
  quoteId: string;
  reason: "not_found" | "expired";
  expiresAt?: string | null;
}) {
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center py-16">
        <div className="flex justify-center mb-3">
          <YugoLogo size={28} variant="gold" onLightBackground />
        </div>
        <div className="w-16 h-px bg-[#B8962E] mx-auto mb-6" />
        {reason === "expired" ? (
          <>
            <h1 className="font-heading text-[20px] font-bold text-[#2C3E2D] mb-3">This Quote Has Expired</h1>
            <p className="text-[var(--text-base)] text-[#2C3E2D]/70 leading-relaxed mb-2">
              Your quote{expiryDate ? ` was valid until ${expiryDate}` : " is no longer available"}.
              Prices and availability may have changed since then.
            </p>
            <p className="text-[12px] text-[#2C3E2D]/50 mb-8 font-mono">{quoteId}</p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-[20px] font-bold text-[#2C3E2D] mb-3">Quote Not Found</h1>
            <p className="text-[var(--text-base)] text-[#2C3E2D]/70 leading-relaxed mb-6">
              We couldn&apos;t find a quote with ID <span className="font-mono font-semibold">{quoteId}</span>.
              Please check the link from your email.
            </p>
          </>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:info@helloyugo.com?subject=New%20Quote%20Request"
            className="inline-block px-6 py-3 rounded-lg bg-[#B8962E] text-white text-[13px] font-semibold tracking-wide hover:bg-[#A07F26] transition-colors"
          >
            Request a New Quote
          </a>
          <a
            href="tel:+14168001234"
            className="inline-block px-6 py-3 rounded-lg border border-[#2C3E2D]/20 text-[#2C3E2D] text-[13px] font-medium hover:bg-[#2C3E2D]/5 transition-colors"
          >
            Call Us
          </a>
        </div>
      </div>
    </div>
  );
}
