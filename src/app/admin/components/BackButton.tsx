"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

interface BackButtonProps {
  label?: string;
  /** @deprecated Pass no href; router.back() is always used now */
  href?: string;
  className?: string;
}

export default function BackButton({ label = "Back", className = "" }: BackButtonProps) {
  const router = useRouter();
  const baseClass = `inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors ${className}`;
  const icon = <ArrowLeft size={14} className="shrink-0 text-current" aria-hidden />;

  return (
    <button type="button" onClick={() => router.back()} className={baseClass}>
      {icon}
      {label}
    </button>
  );
}
