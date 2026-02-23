"use client";

/** Progress bar with start pin and destination. Progress starts when team is en route to pickup. No car icon. */
export default function DeliveryProgressBar({
  percent,
  label,
  sublabel,
  variant = "dark",
}: {
  percent: number;
  label?: string;
  sublabel?: string;
  variant?: "dark" | "light";
}) {
  const pct = Math.min(100, Math.max(0, percent));
  const isDark = variant === "dark";
  const isComplete = pct >= 100;

  const trackBg = isDark ? "#2A2A2A" : "#E8E4DF";
  const fillGradient = "linear-gradient(90deg, #8B5CF6 0%, #A78BFA 50%, #C084FC 100%)";
  const endCircleBg = isComplete ? "#22C55E" : (isDark ? "#2A2A2A" : "#D4D0C8");
  const endCircleRing = isComplete ? "rgba(34,197,94,0.5)" : (isDark ? "#1A1A1A" : "#C0BCB4");

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {label && <span className="text-[13px] font-semibold text-[var(--tx)] truncate">{label}</span>}
          {sublabel && <span className="text-[12px] text-[var(--tx3)] shrink-0">{sublabel}</span>}
        </div>
      )}
      <div className="relative flex items-center w-full">
        {/* Start marker - magenta circle with pin */}
        <div
          className="absolute left-0 z-20 flex items-center justify-center shrink-0 rounded-full"
          style={{
            width: 24,
            height: 24,
            background: fillGradient,
            boxShadow: "0 0 0 2px rgba(139,92,246,0.4)",
          }}
        >
          <svg width="10" height="12" viewBox="0 0 24 24" fill="none" className="text-white drop-shadow-sm">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor" />
          </svg>
        </div>

        {/* Track */}
        <div
          className="flex-1 mx-4 h-1.5 min-w-0 rounded-full overflow-hidden"
          style={{ background: trackBg }}
        >
          {/* Filled portion - gradient */}
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: fillGradient,
            }}
          />
        </div>

        {/* End marker - green check when complete, otherwise gray circle */}
        <div
          className="absolute right-0 z-20 flex items-center justify-center shrink-0 rounded-full"
          style={{
            width: 24,
            height: 24,
            background: endCircleBg,
            border: `2px solid ${endCircleRing}`,
          }}
        >
          {isComplete ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                background: isDark ? "#1A1A1A" : "#999",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
