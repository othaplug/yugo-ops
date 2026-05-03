import { Suspense } from "react";
import PartnersV3Client from "./PartnersV3Client";

export const metadata = { title: "Partners" };
export const dynamic = "force-dynamic";

function PartnersLoading() {
  return (
    <div className="w-full py-12 text-[13px] text-[var(--yu3-ink-muted)] text-center">
      Loading…
    </div>
  );
}

export default function AllPartnersPage() {
  return (
    <Suspense fallback={<PartnersLoading />}>
      <PartnersV3Client />
    </Suspense>
  );
}
