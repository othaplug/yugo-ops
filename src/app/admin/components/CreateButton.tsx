"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";

const PlusIcon = () => (
  <Plus size={14} weight="bold" className="text-current" aria-hidden />
);

/**
 * Admin primary CTA. Use `label` for all real actions (every admin button needs
 * a text label per P2.3 of the consistency sweep). Icon-only fallback remains
 * for internal chrome callers only.
 */
export const createButtonIconClass =
  "inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--yu3-on-wine)] transition-colors " +
  "bg-[var(--yu3-wine)] border border-[var(--yu3-wine)] " +
  "hover:bg-[var(--yu3-wine-hover)] hover:border-[var(--yu3-wine-hover)] " +
  "active:scale-[0.98] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]";

export const createButtonLabelClass =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-[var(--yu3-on-wine)] transition-colors " +
  "bg-[var(--yu3-wine)] border border-[var(--yu3-wine)] " +
  "text-[11px] font-bold uppercase tracking-[0.12em] " +
  "hover:bg-[var(--yu3-wine-hover)] hover:border-[var(--yu3-wine-hover)] " +
  "active:scale-[0.98] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]";

export const createButtonBaseClass = createButtonIconClass;

interface CreateButtonProps {
  href?: string;
  onClick?: () => void;
  title: string;
  label?: string;
  className?: string;
}

export default function CreateButton({
  href,
  onClick,
  title,
  label,
  className = "",
}: CreateButtonProps) {
  const base = label ? createButtonLabelClass : createButtonIconClass;
  const combined = `${base} ${className}`.trim();

  const content = label ? (
    <>
      <PlusIcon />
      <span>{label}</span>
    </>
  ) : (
    <PlusIcon />
  );

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        aria-label={title}
        className={combined}
        data-yu3-button=""
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={combined}
    >
      {content}
    </button>
  );
}
