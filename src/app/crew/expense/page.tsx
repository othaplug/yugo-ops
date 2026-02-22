import { Suspense } from "react";
import CrewExpenseClient from "./CrewExpenseClient";

export default function CrewExpensePage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-[var(--tx3)]">Loading…</div>}>
      <CrewExpenseClient />
    </Suspense>
  );
}
