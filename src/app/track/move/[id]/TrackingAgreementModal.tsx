"use client";

import { useState, useEffect } from "react";
import YugoLogo from "@/components/YugoLogo";

const COOKIE_NAME = "yugo-tracking-terms-accepted";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

const WINE = "#2B0416";
const OFF_WHITE = "#F9EDE4";
const CREAM_CARD = "#FFFDF8";
const ROSE = "#66143D";
const ROSE_TINT = "#E0B4C6";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

/**
 * Tracking welcome — the "invitation." First surface a client sees on
 * their tracking portal. Brand-aligned per Yugo brandbook 2026:
 *
 *   - Palette: Wine hero cap + Off-white card body. Rose eyebrows,
 *     italic accent on "your". Gold banned as a CTA fill on this
 *     surface (reads like a bookmaker); primary CTA is solid wine
 *     with letter-spaced sans caps, secondary is a plain outline
 *     under the CTA.
 *   - Typography: Instrument Serif (font-hero) for the headline and
 *     italic accents; Brown (default body) for paragraphs.
 *   - Logo: real Yugo mark via <YugoLogo>, no placeholder Y.
 *   - Copy: legalese folded into two short editorial sections; the
 *     "TERMS OF USE / PRIVACY & DATA / TRACKING & LOCATION / CLAIMS
 *     & LIABILITY" wall is not a welcome, it's a barrier. Move the
 *     detail to /terms + /cookies (already linked).
 */
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
      className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center p-4 sm:p-5 modal-overlay"
      style={{ backgroundColor: "rgba(43,4,22,0.55)" }}
    >
      <div
        className="rounded-t-[2px] sm:rounded-[2px] w-full sm:max-w-[520px] overflow-hidden"
        style={{
          backgroundColor: CREAM_CARD,
          maxHeight: "min(94dvh, 94vh)",
          overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          border: "1px solid rgba(43,4,22,0.10)",
        }}
      >
        <div
          className="px-8 pt-12 pb-11 text-center relative"
          style={{ backgroundColor: WINE, color: OFF_WHITE }}
        >
          <div className="flex justify-center mb-8">
            <YugoLogo size={22} variant="cream" />
          </div>

          <p
            className="text-[10px] mb-5"
            style={{ letterSpacing: "0.28em", color: "rgba(224,180,198,0.9)" }}
          >
            BY INVITATION
          </p>

          <h2
            className="font-hero"
            style={{
              fontSize: 40,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: OFF_WHITE,
              margin: 0,
            }}
          >
            Welcome to{" "}
            <span style={{ fontStyle: "italic", color: ROSE_TINT }}>your tracking.</span>
          </h2>

          <p
            className="mx-auto"
            style={{
              maxWidth: 340,
              marginTop: 22,
              fontSize: 13.5,
              color: "rgba(249,237,228,0.7)",
              fontWeight: 300,
              letterSpacing: "0.005em",
            }}
          >
            A private portal for the arc of your service. Please take a moment.
          </p>
        </div>

        <div className="px-8 pt-11 pb-8">
          <div style={{ marginBottom: 32 }}>
            <p
              className="text-[10px] mb-4"
              style={{ letterSpacing: "0.28em", color: ROSE }}
            >
              ON TERMS
            </p>
            <p
              className="font-hero italic"
              style={{
                fontSize: 19,
                color: WINE,
                margin: "0 0 12px",
                lineHeight: 1.4,
                letterSpacing: "-0.005em",
              }}
            >
              A quiet promise, on both sides.
            </p>
            <p
              style={{
                fontSize: 13.5,
                color: "rgba(43,4,22,0.72)",
                fontWeight: 300,
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              By continuing, you agree to Yugo&rsquo;s{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Privacy Policy
              </a>
              . This portal offers you the crew&rsquo;s location, your inventory in view, and the state of the day, in real time.
            </p>
          </div>

          <hr
            className="border-0 h-px"
            style={{ backgroundColor: "rgba(102,20,61,0.35)", margin: "0 0 32px" }}
          />

          <div style={{ marginBottom: 38 }}>
            <p
              className="text-[10px] mb-4"
              style={{ letterSpacing: "0.28em", color: ROSE }}
            >
              ON WHAT WE HOLD
            </p>
            <p
              className="font-hero italic"
              style={{
                fontSize: 19,
                color: WINE,
                margin: "0 0 12px",
                lineHeight: 1.4,
                letterSpacing: "-0.005em",
              }}
            >
              Only what serves you.
            </p>
            <p
              style={{
                fontSize: 13.5,
                color: "rgba(43,4,22,0.72)",
                fontWeight: 300,
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              Your details are processed to deliver the service, nothing more. Cookies remember your preferences and keep you signed in. You may review the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                full terms
              </a>{" "}
              or the{" "}
              <a href="/cookies" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                cookie policy
              </a>{" "}
              at any time.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            className="w-full transition-opacity hover:opacity-90 active:scale-[0.99]"
            style={{
              backgroundColor: WINE,
              color: OFF_WHITE,
              border: "none",
              padding: "18px 20px",
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            Enter the portal
          </button>

          <p
            className="text-center mt-5"
            style={{
              fontSize: 11,
              color: "rgba(43,4,22,0.42)",
              fontWeight: 300,
              lineHeight: 1.65,
              letterSpacing: "0.01em",
              margin: "20px 0 0",
            }}
          >
            Continuing acknowledges the Terms of Use, Privacy Policy, and Cookie Policy.
          </p>
        </div>

        <div className="text-center pb-8">
          <div
            className="inline-flex items-center gap-4"
            style={{ color: "rgba(43,4,22,0.32)" }}
          >
            <span className="h-px w-6 block" style={{ backgroundColor: "currentColor" }} />
            <span className="font-hero italic" style={{ fontSize: 12, letterSpacing: "0.04em" }}>
              Yugo
            </span>
            <span className="h-px w-6 block" style={{ backgroundColor: "currentColor" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: ROSE,
  textDecoration: "none",
  borderBottom: "0.5px solid rgba(102,20,61,0.35)",
  paddingBottom: 1,
};
