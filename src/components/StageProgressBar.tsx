"use client";

import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";

/** Forest + cream accents — no gold chrome (client track / quote system). */
const FOREST = "#2C3E2D";
const CREAM_ON_DARK = "#EDE6DC";

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
  const isComplete = completedCount >= total;

  // Delay fill animation until after mount so CSS transition fires
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  const isDark = variant === "dark";
  const accent = isDark ? CREAM_ON_DARK : FOREST;

  return (
    <div className="w-full py-5">


      {/* ── Nodes + connectors ── */}
      <div className="flex items-start">
        {stages.map((s, i) => {
          const isDone = i < completedCount;
          const isCurrent = i === completedCount - 1 && !isComplete;
          const isLast = i === total - 1;

          return (
            <div key={s.label} className="flex items-start flex-1 last:flex-none">

              {/* Node + label */}
              <div className="flex flex-col items-center min-w-0">

                {/* Circle node */}
                <div className="relative flex items-center justify-center">
                  {/* Outer glow ring for active */}
                  {isCurrent && (
                    <span
                      className="absolute rounded-full animate-ping"
                      style={{
                        width: 36,
                        height: 36,
                        background: isDark
                          ? "rgba(237,230,220,0.22)"
                          : "rgba(44,62,45,0.12)",
                      }}
                    />
                  )}
                  {/* Complete last-node glow */}
                  {isComplete && isLast && (
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(34,197,94,0.12)",
                        animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                      }}
                    />
                  )}

                  <div
                    className="relative z-10 flex items-center justify-center rounded-full transition-all duration-500"
                    style={{
                      width: isLast && (isDone || isCurrent) ? 28 : 24,
                      height: isLast && (isDone || isCurrent) ? 28 : 24,
                      background: isDone
                        ? isLast && isComplete
                          ? "#22C55E"
                          : "rgba(34,197,94,0.15)"
                        : isCurrent
                        ? accent
                        : isDark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(44,62,45,0.06)",
                      border: isDone
                        ? `1.5px solid ${isLast && isComplete ? "#22C55E" : "rgba(34,197,94,0.45)"}`
                        : isCurrent
                        ? "none"
                        : `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : `${FOREST}22`}`,
                      boxShadow: isComplete && isLast
                        ? "0 0 0 4px rgba(34,197,94,0.12), 0 2px 8px rgba(34,197,94,0.2)"
                        : isCurrent
                        ? isDark
                          ? "0 0 0 4px rgba(237,230,220,0.2), 0 2px 8px rgba(0,0,0,0.12)"
                          : "0 0 0 4px rgba(44,62,45,0.12), 0 2px 8px rgba(44,62,45,0.15)"
                        : "none",
                    }}
                  >
                    {isDone ? (
                      <Check
                        weight="bold"
                        size={isLast && isComplete ? 12 : 9}
                        color={isLast && isComplete ? "#fff" : "#22C55E"}
                        aria-hidden
                      />
                    ) : isCurrent ? (
                      <span
                        className="rounded-full"
                        style={{
                          width: 7,
                          height: 7,
                          background: isDark ? "#1A1A1A" : "#FFFBF7",
                          opacity: isDark ? 0.85 : 1,
                        }}
                      />
                    ) : (
                      <span
                        className="rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          background: isDark ? "rgba(255,255,255,0.15)" : `${FOREST}35`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Stage label */}
                <span
                  className="mt-2.5 text-[11px] font-semibold text-center leading-tight tracking-wide transition-colors duration-300"
                  style={{
                    color: isDone
                      ? isComplete
                        ? "#22C55E"
                        : isDark
                          ? "rgba(232,229,224,0.85)"
                          : FOREST
                      : isCurrent
                      ? accent
                      : isDark
                      ? "rgba(255,255,255,0.22)"
                      : `${FOREST}55`,
                  }}
                >
                  {s.label}
                </span>
              </div>

              {/* Connector line (not after last node) */}
              {!isLast && (
                <div
                  className="flex-1 mx-1 relative overflow-hidden rounded-full"
                  style={{
                    height: 2,
                    marginTop: 11,
                    background: isDark ? "rgba(255,255,255,0.07)" : `${FOREST}12`,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all ease-out"
                    style={{
                      width: animated
                        ? isDone
                          ? "100%"
                          : isCurrent
                          ? "50%"
                          : "0%"
                        : "0%",
                      transitionDuration: "700ms",
                      transitionDelay: `${i * 80}ms`,
                      background: isComplete
                        ? "linear-gradient(90deg, #22C55E, #16A34A)"
                        : isDark
                        ? `linear-gradient(90deg, ${CREAM_ON_DARK}, rgba(237,230,220,0.35))`
                        : `linear-gradient(90deg, ${FOREST}, #1C3A2B)`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
