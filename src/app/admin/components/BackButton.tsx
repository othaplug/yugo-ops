"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

type BackButtonVariant = "v1" | "v2";

interface BackButtonProps {
  label?: string;
  /** @deprecated Pass no href; router.back() is always used now */
  href?: string;
  /** Fallback route when there is no browser history to go back to */
  fallback?: string;
  className?: string;
  /** Admin v2: neutral + accent hover, no gold */
  variant?: BackButtonVariant;
}

export default function BackButton({
  label = "Back",
  fallback = "/admin",
  className = "",
  variant = "v1",
}: BackButtonProps) {
  const router = useRouter();
  const isV2 = variant === "v2";
  const baseClass = isV2
    ? `inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle transition-colors hover:text-accent ${className}`
    : `inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--accent-text)] transition-colors ${className}`;
  const icon = <ArrowLeft size={14} weight="regular" className="shrink-0 text-current" aria-hidden />;

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button type="button" onClick={handleBack} className={baseClass}>
      {icon}
      {label}
    </button>
  );
}
