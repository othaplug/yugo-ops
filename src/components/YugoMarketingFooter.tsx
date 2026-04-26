"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";

type YugoLogoVariant = "cream" | "black" | "wine" | "gold";

export type YugoMarketingFooterProps = {
  contactEmail: string;
  logoVariant: YugoLogoVariant;
  onLightBackground?: boolean;
  logoSize?: number;
  /** Muted text; “Powered by” label uses the same tone. */
  mutedColor: string;
  /** Terms, Privacy, Contact us */
  linkColor: string;
  className?: string;
  /** When false, omit logo and “Powered by” row (e.g. page already has a hero mark). */
  showLogo?: boolean;
  /** Override nav row text size (e.g. embedded widget). Also applied to “Powered by”. */
  navClassName?: string;
};

export default function YugoMarketingFooter({
  contactEmail,
  logoVariant,
  onLightBackground,
  logoSize = 14,
  mutedColor,
  linkColor,
  className,
  showLogo = true,
  navClassName = "",
}: YugoMarketingFooterProps) {
  const mail = contactEmail?.trim() || "support@helloyugo.com";
  const linkStyle: CSSProperties = { color: linkColor };

  return (
    <div className={className}>
      <nav
        className={`text-[11px] mt-0 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 ${navClassName}`.trim()}
        aria-label="Legal and contact"
      >
        <Link
          href="/terms"
          className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
          style={linkStyle}
        >
          Terms of Service
        </Link>
        <span style={{ color: mutedColor }} className="opacity-50" aria-hidden>
          ·
        </span>
        <Link
          href="/privacy"
          className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
          style={linkStyle}
        >
          Privacy
        </Link>
        <span style={{ color: mutedColor }} className="opacity-50" aria-hidden>
          ·
        </span>
        <a
          href={`mailto:${encodeURIComponent(mail)}`}
          className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
          style={linkStyle}
        >
          Contact us
        </a>
      </nav>

      {showLogo ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
          aria-label="Powered by Yugo"
        >
          <span
            className={`font-medium tracking-wide ${navClassName || "text-[11px]"}`.trim()}
            style={{ color: mutedColor }}
          >
            Powered by
          </span>
          <YugoLogo
            size={logoSize}
            variant={logoVariant}
            onLightBackground={onLightBackground}
          />
        </div>
      ) : null}
    </div>
  );
}
