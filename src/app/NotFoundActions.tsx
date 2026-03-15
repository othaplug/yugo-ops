"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Renders 404 action buttons. For client-facing /track/* paths, "Go Home"
 * links to /tracking so users are never sent to the app login.
 */
export default function NotFoundActions() {
  const pathname = usePathname() ?? "";
  const isClientTrack = pathname.startsWith("/track");

  return (
    <div className="flex flex-wrap justify-center gap-4">
      <Link
        href={isClientTrack ? "/tracking" : "/"}
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
