"use client";

import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import { WINE, FOREST, GOLD, CREAM, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";

export default function ClientPage() {
  return (
    <div className="min-h-screen font-sans flex items-center justify-center px-5" style={{ backgroundColor: CREAM }}>
      <div className="max-w-md text-center">
        <YugoLogo size={22} variant="gold" className="mb-6 inline-block" />
        <h1 className="font-hero text-xl md:text-2xl font-bold mb-3" style={{ color: WINE }}>
          Track Your Move
        </h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: FOREST }}>
          Use the tracking link we sent to your email to view your move details, inventory, documents, and message your coordinator. No account or login required.
        </p>
        <p className="text-[11px] mb-8" style={{ color: TEXT_MUTED_ON_LIGHT }}>
          Can&apos;t find the link? Check your spam folder or contact your coordinator.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 rounded-lg text-[12px] font-semibold border-2 transition-colors hover:bg-[#2C3E2D] hover:text-[#F9EDE4]"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
