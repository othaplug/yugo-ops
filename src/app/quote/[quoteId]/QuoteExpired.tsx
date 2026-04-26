"use client";

import YugoLogo from "@/components/YugoLogo";
import YugoMarketingFooter from "@/components/YugoMarketingFooter";
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
  reason: "not_found" | "expired" | "declined" | "lost";
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
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ backgroundColor: CREAM }}
    >
      <div className="max-w-md w-full text-center py-16">
        <div className="flex justify-center mb-3">
          <YugoLogo size={28} variant="wine" onLightBackground />
        </div>
        <div
          className="w-16 h-px mx-auto mb-6"
          style={{ backgroundColor: "#2C3E2D" }}
        />
        {reason === "expired" ? (
          <>
            <h1
              className="font-hero text-[30px] sm:text-[34px] font-bold leading-tight mb-3"
              style={{ color: FOREST }}
            >
              This Quote Has Expired
            </h1>
            <p
              className="text-[13px] leading-relaxed mb-2"
              style={{ color: FOREST }}
            >
              Your quote
              {expiryDate
                ? ` was valid until ${expiryDate}`
                : " is no longer available"}
              . Prices and availability may have changed since then.
            </p>
            <p
              className="text-[12px] mb-8 font-mono"
              style={{ color: TEXT_MUTED_ON_LIGHT }}
            >
              {quoteId}
            </p>
          </>
        ) : reason === "declined" ? (
          <>
            <h1
              className="font-hero text-[30px] sm:text-[34px] font-bold leading-tight mb-3"
              style={{ color: FOREST }}
            >
              Quote Closed
            </h1>
            <p
              className="text-[13px] leading-relaxed mb-2"
              style={{ color: FOREST }}
            >
              This quote is no longer active. If your plans change, your
              coordinator can send a refreshed quote anytime.
            </p>
            <p
              className="text-[12px] mb-8 font-mono"
              style={{ color: TEXT_MUTED_ON_LIGHT }}
            >
              {quoteId}
            </p>
          </>
        ) : reason === "lost" ? (
          <>
            <h1
              className="font-hero text-[30px] sm:text-[34px] font-bold leading-tight mb-3"
              style={{ color: FOREST }}
            >
              Quote Unavailable
            </h1>
            <p
              className="text-[13px] leading-relaxed mb-2"
              style={{ color: FOREST }}
            >
              This quote link is no longer available. Please reach out if you
              would like a new estimate.
            </p>
            <p
              className="text-[12px] mb-8 font-mono"
              style={{ color: TEXT_MUTED_ON_LIGHT }}
            >
              {quoteId}
            </p>
          </>
        ) : (
          <>
            <h1
              className="font-hero text-[30px] sm:text-[34px] font-bold leading-tight mb-3"
              style={{ color: FOREST }}
            >
              Quote Not Found
            </h1>
            <p
              className="text-[13px] leading-relaxed mb-6"
              style={{ color: FOREST }}
            >
              We couldn&apos;t find a quote with ID{" "}
              <span className="font-mono font-semibold">{quoteId}</span>. Please
              check the link from your email.
            </p>
          </>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center min-w-0">
          <a
            href={`mailto:${mail}?subject=${mailSubject}`}
            className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] min-w-0 rounded-lg bg-[#2C3E2D] text-white text-[11px] font-bold uppercase tracking-[0.12em] leading-none hover:bg-[#243628] transition-colors"
          >
            Request a New Quote
          </a>
          <a
            href={telHref}
            className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-lg border border-[#2C3E2D]/25 text-[#2C3E2D] text-[11px] font-bold uppercase tracking-[0.12em] leading-none hover:bg-[#2C3E2D]/5 transition-colors"
          >
            Call Us
          </a>
        </div>
        <div className="mt-10 pt-6 border-t border-[#2C3E2D]/12">
          <YugoMarketingFooter
            contactEmail={mail}
            logoVariant="wine"
            onLightBackground
            logoSize={12}
            mutedColor={TEXT_MUTED_ON_LIGHT}
            linkColor={FOREST}
          />
        </div>
      </div>
    </div>
  );
}
