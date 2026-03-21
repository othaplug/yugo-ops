"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";

const PlusIcon = () => <Plus size={16} weight="regular" className="text-current" aria-hidden />;

/** Shared gold FAB: soft outer lift + single top inset highlight (no dark bottom inset — avoids crescent artifacts on circles). */
export const createButtonBaseClass =
  "inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--btn-text-on-accent)] transition-all duration-300 ease-[var(--ease-out-expo)] " +
  "bg-gradient-to-b from-[#E8D98A] via-[#C9A962] to-[#9A7B38] " +
  "shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.28)] " +
  "hover:shadow-[0_4px_14px_rgba(201,169,98,0.35),0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.32)] " +
  "hover:scale-[1.03] active:scale-[0.97] " +
  "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),inset_0_-1px_0_rgba(255,255,255,0.08)] " +
  "ring-1 ring-black/[0.06]";

interface CreateButtonProps {
  href?: string;
  onClick?: () => void;
  title: string;
  className?: string;
}

export default function CreateButton({ href, onClick, title, className = "" }: CreateButtonProps) {
  const combined = `${createButtonBaseClass} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} title={title} aria-label={title} className={combined}>
        <PlusIcon />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={combined}>
      <PlusIcon />
    </button>
  );
}
