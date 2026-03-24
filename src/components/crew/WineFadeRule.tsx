"use client";

/**
 * Horizontal rule: burgundy/wine tone, strongest at center, transparent at ends.
 */
export default function WineFadeRule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px w-full shrink-0 ${className}`}
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(110, 32, 52, 0.2) 14%, rgba(130, 42, 62, 0.72) 50%, rgba(110, 32, 52, 0.2) 86%, transparent 100%)",
      }}
      aria-hidden
    />
  );
}
