"use client";

/** Segmented progress bar with glass effect. Shows discrete steps (e.g. move status flow). */
export default function SegmentedProgressBar({
  steps,
  currentIndex,
  label,
  className = "",
}: {
  steps: { key: string; label: string }[];
  currentIndex: number;
  label?: string;
  className?: string;
}) {
  const total = steps.length;
  const filledCount = Math.min(currentIndex + 1, total);
  const isAllComplete = currentIndex >= total - 1;
  return (
    <div className={`glass rounded-xl p-4 ${className}`}>
      {label && (
        <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--gold)]/90 mb-3">{label}</div>
      )}
      <div className="flex gap-1.5 h-2.5 w-full">
        {steps.map((step, i) => {
          const isComplete = i < currentIndex || isAllComplete;
          const isCurrent = i === currentIndex && !isAllComplete;
          return (
            <div
              key={step.key}
              className="flex-1 rounded-md min-w-[6px] transition-all duration-300"
              style={{
                background: isComplete
                  ? "linear-gradient(180deg, var(--grn) 0%, rgba(45,159,90,0.7) 100%)"
                  : isCurrent
                    ? "linear-gradient(180deg, var(--gold) 0%, rgba(201,169,98,0.6) 100%)"
                    : "rgba(255,255,255,0.1)",
                boxShadow: isComplete ? "0 0 6px rgba(45,159,90,0.25)" : isCurrent ? "0 0 6px rgba(201,169,98,0.2)" : "none",
              }}
              title={step.label}
            />
          );
        })}
      </div>
      <div className="text-[12px] font-semibold text-[var(--tx2)] mt-2">
        {filledCount} / {total} {steps[Math.min(currentIndex, total - 1)]?.label ?? ""}
      </div>
    </div>
  );
}
