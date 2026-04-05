"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";

const PlusIcon = () => (
  <Plus size={16} weight="regular" className="text-current" aria-hidden />
);

/** Admin primary icon control — tight corners (partner-style), wine / bronze accent. */
export const createButtonBaseClass =
  "inline-flex items-center justify-center w-10 h-10 rounded-[2px] text-[var(--btn-text-on-accent)] transition-colors duration-300 ease-[var(--ease-out-expo)] " +
  "bg-[var(--admin-primary-fill)] border border-[var(--admin-primary-fill)] " +
  "hover:bg-[var(--admin-primary-fill-hover)] hover:border-[var(--admin-primary-fill-hover)] " +
  "active:scale-[0.98] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-primary-fill)]";

interface CreateButtonProps {
  href?: string;
  onClick?: () => void;
  title: string;
  className?: string;
}

export default function CreateButton({
  href,
  onClick,
  title,
  className = "",
}: CreateButtonProps) {
  const combined = `${createButtonBaseClass} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} title={title} aria-label={title} className={combined}>
        <PlusIcon />
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
      <PlusIcon />
    </button>
  );
}
