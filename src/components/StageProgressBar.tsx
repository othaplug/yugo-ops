"use client";

import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";

/** Forest + cream accents — no gold chrome (client track / quote system). */
const FOREST = "#2C3E2D";
const FOREST_DEEP = "#1C3A2B";
const WINE = "#5C1A33";
const CREAM_ON_DARK = "#EDE6DC";
const FOREST_MUTE = "rgba(44,62,45,0.15)";
const FOREST_MUTE_BORDER = "rgba(44,62,45,0.45)";
const FOREST_GLOW = "rgba(44,62,45,0.12)";
const DARK_DONE_FILL = "rgba(237,230,220,0.2)";
const DARK_DONE_BORDER = "rgba(237,230,220,0.45)";

export default function StageProgressBar({
  stages,
  currentIndex,
  variant = "dark",
  /** Light variant only: wine-tinted inactive chrome for crew premium job screen. */
  lightAccent = "forest",
  /** Smaller labels when many stages (e.g. full move flow on crew job). */
  dense = false,
}: {
  stages: { label: string }[];
  currentIndex: number; // 0-based; -1 = not started
  variant?: "dark" | "light";
  lightAccent?: "forest" | "wine";
  dense?: boolean;
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
  const lightInk = lightAccent === "wine" ? WINE : FOREST;
  const accent = isDark ? CREAM_ON_DARK : lightInk;

  return (
    <div className="w-full py-5">


      {/* ── Nodes + connectors ── */}
      <div
        className={
          dense
            ? "flex items-start w-full min-w-0 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]"
            : "flex items-start"
        }
      >
        {stages.map((s, i) => {
          const isDone = i < completedCount;
          const isCurrent = i === completedCount - 1 && !isComplete;
          const isLast = i === total - 1;

          return (
            <div
              key={`${s.label}-${i}`}
              className={
                dense
                  ? "flex items-start flex-1 min-w-[2.4rem] sm:min-w-[2.75rem] last:flex-none"
                  : "flex items-start flex-1 last:flex-none"
              }
            >

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
                          : lightAccent === "wine"
                            ? "rgba(92,26,51,0.14)"
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
                        background: isDark ? "rgba(237,230,220,0.14)" : FOREST_GLOW,
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
                          ? isDark
                            ? CREAM_ON_DARK
                            : FOREST
                          : isDark
                            ? DARK_DONE_FILL
                            : FOREST_MUTE
                        : isCurrent
                        ? accent
                        : isDark
                        ? "rgba(255,255,255,0.04)"
                        : lightAccent === "wine"
                          ? "rgba(92,26,51,0.06)"
                          : "rgba(44,62,45,0.06)",
                      border: isDone
                        ? `1.5px solid ${
                            isLast && isComplete
                              ? isDark
                                ? "rgba(237,230,220,0.55)"
                                : FOREST
                              : isDark
                                ? DARK_DONE_BORDER
                                : FOREST_MUTE_BORDER
                          }`
                        : isCurrent
                        ? "none"
                        : isDark
                        ? "1.5px solid rgba(255,255,255,0.12)"
                        : lightAccent === "wine"
                          ? "1.5px solid rgba(92,26,51,0.2)"
                          : `1.5px solid ${FOREST}22`,
                      boxShadow: isComplete && isLast
                        ? isDark
                          ? "0 0 0 4px rgba(237,230,220,0.12), 0 2px 8px rgba(0,0,0,0.2)"
                          : `0 0 0 4px ${FOREST_GLOW}, 0 2px 8px rgba(44,62,45,0.2)`
                        : isCurrent
                        ? isDark
                          ? "0 0 0 4px rgba(237,230,220,0.2), 0 2px 8px rgba(0,0,0,0.12)"
                          : lightAccent === "wine"
                            ? "0 0 0 4px rgba(92,26,51,0.14), 0 2px 10px rgba(92,26,51,0.12)"
                            : "0 0 0 4px rgba(44,62,45,0.12), 0 2px 8px rgba(44,62,45,0.15)"
                        : "none",
                    }}
                  >
                    {isDone ? (
                      <Check
                        weight="bold"
                        size={isLast && isComplete ? 12 : 9}
                        color={
                          isLast && isComplete
                            ? isDark
                              ? FOREST
                              : "#FFFBF7"
                            : FOREST
                        }
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
                          background: isDark
                            ? "rgba(255,255,255,0.15)"
                            : lightAccent === "wine"
                              ? "rgba(92,26,51,0.28)"
                              : `${FOREST}35`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Stage label */}
                <span
                  className={
                    dense
                      ? "mt-2 text-[8px] sm:text-[9px] font-semibold text-center leading-tight tracking-wide transition-colors duration-300 px-px"
                      : "mt-2.5 text-[11px] font-semibold text-center leading-tight tracking-wide transition-colors duration-300"
                  }
                  style={{
                    color: isDone
                      ? isComplete
                        ? isDark
                          ? CREAM_ON_DARK
                          : FOREST
                        : isDark
                          ? "rgba(232,229,224,0.85)"
                          : FOREST
                      : isCurrent
                      ? accent
                      : isDark
                      ? "rgba(255,255,255,0.22)"
                      : lightAccent === "wine"
                        ? "rgba(92,26,51,0.42)"
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
                    background: isDark
                      ? "rgba(255,255,255,0.07)"
                      : lightAccent === "wine"
                        ? "rgba(92,26,51,0.1)"
                        : `${FOREST}12`,
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
                        ? isDark
                          ? `linear-gradient(90deg, ${CREAM_ON_DARK}, rgba(237,230,220,0.35))`
                          : `linear-gradient(90deg, ${FOREST}, ${FOREST_DEEP})`
                        : isDark
                        ? `linear-gradient(90deg, ${CREAM_ON_DARK}, rgba(237,230,220,0.35))`
                        : lightAccent === "wine"
                          ? "linear-gradient(90deg, #5C1A33, #3d1224)"
                          : `linear-gradient(90deg, ${FOREST}, ${FOREST_DEEP})`,
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
