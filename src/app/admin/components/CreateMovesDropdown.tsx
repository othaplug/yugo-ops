"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createButtonBaseClass } from "./CreateButton";

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><rect x="1" y="7" width="22" height="14" rx="2" /><path d="M16 7V3a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" /></svg>
            </span>
            New Move
          </Link>
          <Link
            href="/admin/quotes/new"
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
            </span>
            New Quote
          </Link>
        </div>
      )}
    </div>
  );
}
