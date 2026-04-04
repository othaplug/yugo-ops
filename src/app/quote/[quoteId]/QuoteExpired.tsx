"use client";

import YugoLogo from "@/components/YugoLogo";
import { CREAM, FOREST, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";
import { normalizePhone } from "@/lib/phone";
import { formatDateEt } from "@/lib/datetime-et";

export default function QuoteExpired({
  quoteId,
  reason,
  expiresAt,
  supportEmail,
  supportTel,
}: {
  quoteId: string;
  reason: "not_found" | "expired";
  expiresAt?: string | null;
  supportEmail?: string;
  supportTel?: string;
}) {
  const expiryDate = expiresAt ? formatDateEt(expiresAt, "date") : null;
  const mail = supportEmail?.trim() || "support@helloyugo.com";
  const mailSubject = encodeURIComponent("New Quote Request");
  const telDigits = supportTel ? normalizePhone(supportTel) : "";
  const telHref =
    telDigits.length === 10 ? `tel:+1${telDigits}` : "tel:+16473704525";

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: CREAM }}>
      <div className="max-w-md w-full text-center py-16">
        <div className="flex justify-center mb-3">
          <YugoLogo size={28} variant="gold" onLightBackground />
        </div>
        <div className="w-16 h-px mx-auto mb-6" style={{ backgroundColor: "#2C3E2D" }} />
        {reason === "expired" ? (
          <>
            <h1 className="font-hero text-[20px] font-bold mb-3" style={{ color: FOREST }}>
              This Quote Has Expired
            </h1>
            <p
              className="text-[var(--text-base)] leading-relaxed mb-2"
              style={{ color: FOREST }}
            >
              Your quote{expiryDate ? ` was valid until ${expiryDate}` : " is no longer available"}.
              Prices and availability may have changed since then.
            </p>
            <p className="text-[12px] mb-8 font-mono" style={{ color: TEXT_MUTED_ON_LIGHT }}>
              {quoteId}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-hero text-[20px] font-bold mb-3" style={{ color: FOREST }}>
              Quote Not Found
            </h1>
            <p className="text-[var(--text-base)] leading-relaxed mb-6" style={{ color: FOREST }}>
              We couldn&apos;t find a quote with ID <span className="font-mono font-semibold">{quoteId}</span>.
              Please check the link from your email.
            </p>
          </>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center min-w-0">
          <a
            href={`mailto:${mail}?subject=${mailSubject}`}
            className="inline-block px-6 py-3 min-h-[44px] min-w-0 rounded-lg bg-[#2C3E2D] text-white text-[13px] font-semibold tracking-wide hover:bg-[#243628] transition-colors"
          >
            Request a New Quote
          </a>
          <a
            href={telHref}
            className="inline-block px-6 py-3 min-h-[44px] rounded-lg border border-[#2C3E2D]/25 text-[#2C3E2D] text-[13px] font-medium hover:bg-[#2C3E2D]/5 transition-colors"
          >
            Call Us
          </a>
        </div>
      </div>
    </div>
  );
}
