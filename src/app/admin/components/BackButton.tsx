"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  label?: string;
  /** @deprecated Pass no href; router.back() is always used now */
  href?: string;
  className?: string;
}

export default function BackButton({ label = "Back", className = "" }: BackButtonProps) {
  const router = useRouter();
  const baseClass = `inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors ${className}`;
  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );

  return (
    <button type="button" onClick={() => router.back()} className={baseClass}>
      {icon}
      {label}
    </button>
  );
}
