import { Suspense } from "react";
import ReviewPageClient from "./ReviewPageClient";

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
          <p className="text-[var(--text-base)] text-[#B8B5B0]">Loading…</p>
        </div>
      }
    >
      <ReviewPageClient />
    </Suspense>
  );
}
