"use client";

import YugoLogo from "@/components/YugoLogo";

export default function QuoteExpired({ quoteId, reason }: { quoteId: string; reason: "not_found" | "expired" }) {
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
            <p className="text-[14px] text-[#2C3E2D]/70 leading-relaxed mb-6">
              Quote <span className="font-mono font-semibold">{quoteId}</span> is no longer available.
              Please contact us for an updated quote.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-[20px] font-bold text-[#2C3E2D] mb-3">Quote Not Found</h1>
            <p className="text-[14px] text-[#2C3E2D]/70 leading-relaxed mb-6">
              We couldn&apos;t find a quote with ID <span className="font-mono font-semibold">{quoteId}</span>.
              Please check the link from your email.
            </p>
          </>
        )}
        <a
          href="mailto:info@helloyugo.com"
          className="inline-block px-6 py-3 rounded-lg bg-[#B8962E] text-white text-[13px] font-semibold tracking-wide hover:bg-[#A07F26] transition-colors"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
}
