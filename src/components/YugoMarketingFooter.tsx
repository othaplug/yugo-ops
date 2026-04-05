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
  /** Tagline + separator dots */
  mutedColor: string;
  /** Terms, Privacy, Contact us */
  linkColor: string;
  taglineClassName?: string;
  className?: string;
  /** When false, omit logo (e.g. page already has a hero mark). */
  showLogo?: boolean;
  /** Override nav row text size (e.g. embedded widget). */
  navClassName?: string;
};

export default function YugoMarketingFooter({
  contactEmail,
  logoVariant,
  onLightBackground,
  logoSize = 14,
  mutedColor,
  linkColor,
  taglineClassName = "text-[11px] font-medium tracking-wide",
  className,
  showLogo = true,
  navClassName = "",
}: YugoMarketingFooterProps) {
  const mail = contactEmail?.trim() || "support@helloyugo.com";
  const linkStyle: CSSProperties = { color: linkColor };

  return (
    <div className={className}>
      {showLogo ? (
        <div className="flex justify-center mb-1">
          <YugoLogo
            size={logoSize}
            variant={logoVariant}
            onLightBackground={onLightBackground}
          />
        </div>
      ) : null}
      <p className={taglineClassName} style={{ color: mutedColor }}>
        The Art of Moving
      </p>
      <nav
        className={`text-[11px] mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 ${navClassName}`.trim()}
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
    </div>
  );
}
