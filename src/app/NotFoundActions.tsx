"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Renders 404 action buttons. Routes users back to the appropriate home
 * based on path: partner → /partner, track → /tracking, crew → /crew, etc.
 * Never sends partner/client users to admin login.
 */
export default function NotFoundActions() {
  const pathname = usePathname() ?? "";
  const isPartner = pathname.startsWith("/partner");
  const isClientTrack = pathname.startsWith("/track");
  const isCrew = pathname.startsWith("/crew");
  const isPay = pathname.startsWith("/pay");
  const isQuote = pathname.startsWith("/quote");
  const isClaim = pathname.startsWith("/claim");
  const isTracking = pathname.startsWith("/tracking");
  const isReview = pathname.startsWith("/review");
  const isClient = pathname.startsWith("/client");

  const homeHref =
    isPartner ? "/partner" :
    isClientTrack || isTracking || isReview ? "/tracking" :
    isCrew ? "/crew" :
    (isPay || isQuote || isClaim) ? "/tracking" :
    isClient ? "/client" :
    "/";

  return (
    <div className="flex flex-wrap justify-center gap-4">
      <Link
        href={homeHref}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold bg-[#C9A962] text-[#0D0D0D] hover:bg-[#D4B56C] transition-all"
      >
        ← Go Home
      </Link>
      <a
        href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@helloyugo.com"}`}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold border border-[#2A2A2A] text-[#B0ADA8] hover:border-[#C9A962] hover:text-[#E8E5E0] transition-all"
      >
        Contact Us
      </a>
    </div>
  );
}
