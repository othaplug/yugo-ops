import { Suspense } from "react";
import { PMBatchClient } from "@/app/admin/moves/pm-batch/PMBatchClient";

export const metadata = { title: "Schedule PM moves" };

export default function PartnerPmBatchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[13px] text-[var(--yu3-ink-muted)] max-w-4xl mx-auto">
          Loading…
        </div>
      }
    >
      <PMBatchClient />
    </Suspense>
  );
}
