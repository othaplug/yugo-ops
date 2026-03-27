"use client";

import { useState, useEffect } from "react";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { Shield } from "@phosphor-icons/react";

const COOKIE_NAME = "yugo-tracking-terms-accepted";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

export default function TrackingAgreementModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = getCookie(COOKIE_NAME);
    if (!accepted) setShow(true);
  }, []);

  const handleAccept = () => {
    setCookie(COOKIE_NAME, "1", COOKIE_MAX_AGE);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex min-h-0 items-center justify-center p-4 sm:p-5 z-[99990]"
    >
      <div
        className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[480px] shadow-2xl overflow-hidden"
        style={{ backgroundColor: CREAM, maxHeight: "min(92dvh, 92vh)", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-5 text-center" style={{ backgroundColor: WINE }}>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ backgroundColor: `${GOLD}25`, border: `1px solid ${GOLD}40` }}
          >
            <Shield size={22} color={GOLD} />
          </div>
          <h2 className="font-hero text-[22px] font-semibold text-white mb-1">
            Welcome to Yugo+ Tracking
          </h2>
          <p className="text-[12px] text-white/60">
            Before you begin, please review and accept our terms
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div
            className="rounded-xl p-4 mb-4 text-[12px] leading-relaxed max-h-[220px] overflow-y-auto"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E7E5E4",
              color: FOREST,
            }}
          >
            <h4 className="font-bold text-[11px] capitalize tracking-wider mb-2" style={{ color: GOLD }}>
              Terms of Use
            </h4>
            <p className="mb-3">
              By using this tracking portal, you agree to Yugo+&apos;s Terms of Service and Privacy Policy.
              This portal provides real-time updates about your move, including crew location,
              inventory details, and move status.
            </p>

            <h4 className="font-bold text-[11px] capitalize tracking-wider mb-2" style={{ color: GOLD }}>
              Privacy &amp; Data
            </h4>
            <p className="mb-3">
              We collect and process your personal information solely for the purpose of
              providing moving services. Your data is protected and handled in accordance
              with applicable privacy laws. We use cookies and local storage to remember
              your preferences and maintain your session.
            </p>

            <h4 className="font-bold text-[11px] capitalize tracking-wider mb-2" style={{ color: GOLD }}>
              Tracking &amp; Location
            </h4>
            <p className="mb-3">
              Live tracking data is provided for informational purposes. ETAs are estimates
              and may vary based on traffic and other conditions. Location data is shared
              only during active moves and is not stored permanently.
            </p>

            <h4 className="font-bold text-[11px] capitalize tracking-wider mb-2" style={{ color: GOLD }}>
              Claims &amp; Liability
            </h4>
            <p>
              Any claims for damages must be reported within 48 hours of move completion.
              Yugo+&apos;s liability is limited as outlined in your Service Agreement. For full
              details, please review our complete terms.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium underline underline-offset-2"
              style={{ color: GOLD }}
            >
              Full Terms of Use
            </a>
            <span className="text-[10px]" style={{ color: "#CCC" }}>&middot;</span>
            <a
              href="/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium underline underline-offset-2"
              style={{ color: GOLD }}
            >
              Cookie Policy
            </a>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            className="w-full py-3.5 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: GOLD,
              color: "#1A1A1A",
              boxShadow: `0 4px 16px ${GOLD}40`,
            }}
          >
            I Accept &amp; Continue
          </button>

          <p className="text-center text-[10px] mt-3 leading-relaxed" style={{ color: "#AAA" }}>
            By clicking &ldquo;I Accept &amp; Continue&rdquo;, you agree to our Terms of Use,
            Privacy Policy, and Cookie Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
