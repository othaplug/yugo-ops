"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

interface BackButtonProps {
  label?: string;
  /** @deprecated Pass no href; router.back() is always used now */
  href?: string;
  /** Fallback route when there is no browser history to go back to */
  fallback?: string;
  className?: string;
}

export default function BackButton({ label = "Back", fallback = "/admin", className = "" }: BackButtonProps) {
  const router = useRouter();
  const baseClass = `inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors ${className}`;
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
