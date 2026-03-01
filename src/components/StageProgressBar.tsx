"use client";

/**
 * Horizontal stage progress bar matching screenshot design.
 * Purple line for completed portion, gray for incomplete.
 * Stage labels centered below. Progress starts only when team is en route.
 */
export default function StageProgressBar({
  stages,
  currentIndex,
  variant = "dark",
}: {
  stages: { label: string }[];
  currentIndex: number; // 0-based; -1 = not started
  variant?: "dark" | "light";
}) {
  const total = stages.length;
  const completedCount = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, total);
  const percent = total > 0 ? (completedCount / total) * 100 : 0;
  const isComplete = completedCount >= total;

  const trackBg = variant === "dark" ? "#2A2A2A" : "#E8E4DF";
  const fillColor = "#8B5CF6";
  const completedText = variant === "dark" ? "#E8E5E0" : "#1A1A1A";
  const pendingText = variant === "dark" ? "#6B6B6B" : "#888";

  return (
    <div className="w-full">
      {/* Progress line */}
      <div
        className="h-1.5 w-full rounded-full overflow-hidden mb-3"
        style={{ background: trackBg }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
            background: fillColor,
          }}
        />
      </div>

      {/* Stage labels */}
      <div className="flex justify-between">
        {stages.map((s, i) => {
          const isDone = i < completedCount;
          const isCurrent = i === completedCount - 1 && !isComplete;
          return (
            <div
              key={s.label}
              className="flex-1 text-center min-w-0 px-0.5"
              style={{
                color: isDone ? completedText : pendingText,
                fontWeight: isDone || isCurrent ? 600 : 400,
              }}
            >
              <span className="text-[11px] sm:text-[12px] truncate block">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Completion indicator - subtle check at end when complete */}
      {isComplete && (
        <div className="mt-2 flex justify-end">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#22C55E] font-medium">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Complete
          </span>
        </div>
      )}
    </div>
  );
}
