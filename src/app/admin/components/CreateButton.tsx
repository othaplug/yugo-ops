"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";

const PlusIcon = () => <Plus size={16} weight="regular" className="text-current" aria-hidden />;

/** Shared gold FAB: subtle lift + soft top highlight (tuned globally with .sidebar-nav-lift / .btn-*). */
export const createButtonBaseClass =
  "inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--btn-text-on-accent)] transition-all duration-300 ease-[var(--ease-out-expo)] " +
  "bg-gradient-to-b from-[#E8D98A] via-[#2C3E2D] to-[#9A7B38] " +
  "shadow-[0_1px_5px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.16)] " +
  "hover:shadow-[0_2px_10px_rgba(201,169,98,0.22),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "hover:scale-[1.03] active:scale-[0.97] " +
  "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12),inset_0_-1px_0_rgba(255,255,255,0.05)] " +
  "ring-1 ring-black/[0.04]";

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
