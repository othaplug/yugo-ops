"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface BackButtonProps {
  label?: string;
  href?: string;
  className?: string;
}

export default function BackButton({ label = "Back", href, className = "" }: BackButtonProps) {
  const baseClass = `inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors ${className}`;
  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {icon}
        {label}
      </Link>
    );
  }

  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className={baseClass}>
      {icon}
      {label}
    </button>
  );
}
