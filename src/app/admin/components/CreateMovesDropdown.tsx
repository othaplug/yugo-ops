"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createButtonBaseClass } from "./CreateButton";
import { FileText, Plus, Truck } from "@phosphor-icons/react";

const PlusIcon = () => <Plus size={16} className="text-current" aria-hidden />;

export default function CreateMovesDropdown({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        title="Create"
        aria-expanded={open}
        aria-haspopup="true"
        className={createButtonBaseClass}
      >
        <PlusIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[160px] py-1.5 rounded-xl bg-[var(--card)] border border-[var(--brd)] shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            href="/admin/moves/new"
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <Truck size={14} className="text-current" aria-hidden />
            </span>
            New Move
          </Link>
          <Link
            href="/admin/quotes/new"
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <FileText size={14} className="text-current" aria-hidden />
            </span>
            New Quote
          </Link>
        </div>
      )}
    </div>
  );
}
