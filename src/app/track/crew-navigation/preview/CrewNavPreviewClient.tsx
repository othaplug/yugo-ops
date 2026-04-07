"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CrewNavDestination } from "@/components/crew/CrewNavigation";

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
  const router = useRouter();
  return (
    <CrewNavigation
      destination={SAMPLE_DEST}
      sessionId="ui-preview"
      jobType="delivery"
      onExit={() => router.push("/track/move/preview/active")}
      onArrived={() => router.push("/track/move/preview/active")}
    />
  );
}
