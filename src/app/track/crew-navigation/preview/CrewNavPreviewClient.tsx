"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CaretRight } from "@phosphor-icons/react";
import type { CrewNavDestination } from "@/components/crew/CrewNavigation";
import PreviewChromeBanner from "../../move/preview/PreviewChromeBanner";

const CrewNavigation = dynamic(
  () => import("@/components/crew/CrewNavigation").then((m) => m.CrewNavigation),
  { ssr: false }
);

/** Fixed sample destination — Mapbox routing + turn UI (dev / preview only). */
const SAMPLE_DEST: CrewNavDestination = {
  lat: 43.6425662,
  lng: -79.3870578,
  address: "CN Tower, Toronto",
};

export default function CrewNavPreviewClient() {
  const [navOpen, setNavOpen] = useState(false);

  if (navOpen) {
    return (
      <CrewNavigation
        destination={SAMPLE_DEST}
        sessionId="ui-preview"
        jobType="delivery"
        onExit={() => setNavOpen(false)}
        onArrived={() => setNavOpen(false)}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAF7F2]">
      <PreviewChromeBanner variant="crew-navigation" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
        <h1 className="max-w-lg font-hero text-2xl font-semibold leading-tight text-[#1A1816] sm:text-3xl">
          Crew navigation sample
        </h1>
        <p className="max-w-md text-[14px] leading-relaxed text-[#1A1816]/80">
          Opens the same full-screen navigation crew use on active jobs. Uses a fixed Toronto
          destination. GPS and Mapbox token required in the browser.
        </p>
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#2C3E2D] bg-transparent px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2C3E2D] outline-none transition-colors hover:bg-[#2C3E2D]/6 focus-visible:ring-2 focus-visible:ring-[#2C3E2D] focus-visible:ring-offset-2"
        >
          Open sample navigation
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
