"use client";

import { useState, useRef, useEffect } from "react";

/** Polished segmented progress bar with per-step hover tooltips showing date/time. */
export default function SegmentedProgressBar({
  steps,
  currentIndex,
  label,
  className = "",
}: {
  steps: { key: string; label: string; timestamp?: string | null }[];
  currentIndex: number;
  label?: string;
  className?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = steps.length;
  const isAllComplete = currentIndex >= total - 1;

  // Close tooltip on outside click
  useEffect(() => {
    const handler = () => setHoveredIdx(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const formatTs = (ts: string) =>
    new Date(ts).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className={`${className}`} ref={containerRef}>
      {label && (
        <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/60 mb-3">
          {label}
        </div>
      )}

      {/* Segments + tooltips */}
      <div className="flex gap-[3px] w-full" style={{ height: 6 }}>
        {steps.map((step, i) => {
          const isComplete = i < currentIndex || isAllComplete;
          const isCurrent = i === currentIndex && !isAllComplete;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={step.key}
              className="relative flex-1 rounded-full cursor-default transition-all duration-300"
              style={{
                background: isComplete
                  ? "var(--gold)"
                  : isCurrent
                  ? "linear-gradient(90deg, var(--gold) 35%, rgba(201,169,98,0.25) 100%)"
                  : "rgba(255,255,255,0.07)",
                boxShadow: isCurrent
                  ? "0 0 10px rgba(201,169,98,0.35)"
                  : isComplete && isHovered
                  ? "0 0 8px rgba(201,169,98,0.2)"
                  : "none",
                transform: isHovered ? "scaleY(1.5)" : "scaleY(1)",
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="rounded-lg px-3 py-1.5 whitespace-nowrap min-w-[120px] text-center"
                    style={{
                      background: "linear-gradient(160deg, #1e1e1e 0%, #161616 100%)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="text-[10px] font-semibold text-white/90 mb-0.5 leading-tight tracking-wide">
                      {step.label}
                    </div>
                    {step.timestamp ? (
                      <div className="text-[9px] font-medium" style={{ color: "var(--gold)" }}>
                        {formatTs(step.timestamp)}
                      </div>
                    ) : isComplete || isCurrent ? (
                      <div className="text-[9px] text-white/30">No timestamp recorded</div>
                    ) : (
                      <div className="text-[9px] text-white/20 italic">Not yet reached</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex gap-[3px] mt-2 w-full">
        {steps.map((step, i) => {
          const isComplete = i < currentIndex || isAllComplete;
          const isCurrent = i === currentIndex && !isAllComplete;
          return (
            <div
              key={step.key}
              className={`flex-1 text-center text-[8px] truncate px-0.5 leading-tight transition-colors cursor-default ${
                isAllComplete
                  ? "text-[var(--gold)]/70 font-medium"
                  : isComplete
                  ? "text-[var(--tx3)]/50 font-medium"
                  : isCurrent
                  ? "text-[var(--gold)] font-bold"
                  : "text-[var(--tx3)]/25 font-medium"
              }`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {step.label}
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-2 mt-2.5">
        {isAllComplete ? (
          <span className="text-[11px] font-semibold text-[var(--gold)]">
            All stages complete
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[var(--tx2)]">
            {currentIndex + 1}&thinsp;/&thinsp;{total}&ensp;
            <span className="text-[var(--tx3)]/60 font-medium">
              {steps[Math.min(currentIndex, total - 1)]?.label ?? ""}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
