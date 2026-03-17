"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createButtonBaseClass } from "./CreateButton";

interface CreateDeliveryDropdownProps {
  /** Partner type for URL param (designer, hospitality, retail, gallery) */
  type?: string;
  /** When provided, shows Create Project option linking to this URL */
  createProjectHref?: string;
  /** When provided, Project option uses onClick (e.g. for modal) instead of link */
  createProjectOnClick?: () => void;
  /** When provided, shows Add Partner option linking to this URL */
  addPartnerHref?: string;
  className?: string;
}

export default function CreateDeliveryDropdown({ type, createProjectHref, createProjectOnClick, addPartnerHref, className = "" }: CreateDeliveryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const base = "/admin/deliveries/new";
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const paramStr = params.toString() ? `&${params.toString()}` : "";

  const deliveryUrl = `${base}?choice=single${paramStr}`;
  const dayRateUrl = `${base}?choice=day_rate${paramStr}`;
  const b2bOneOffUrl = `${base}?choice=b2b_oneoff${paramStr}`;

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[160px] py-1.5 rounded-xl bg-[var(--card)] border border-[var(--brd)] shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            href={deliveryUrl}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><rect x="1" y="7" width="22" height="14" rx="2" /><path d="M16 7V3a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" /></svg>
            </span>
            Delivery
          </Link>
          <Link
            href={dayRateUrl}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            Day Rate
          </Link>
          <Link
            href={b2bOneOffUrl}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><rect x="1" y="7" width="22" height="14" rx="2" /><path d="M16 7V3a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" /></svg>
            </span>
            B2B One-Off
          </Link>
          {(createProjectHref || createProjectOnClick) && (
            createProjectOnClick ? (
              <button
                type="button"
                onClick={() => { createProjectOnClick(); setOpen(false); }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors w-full text-left first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" /></svg>
                </span>
                Project
              </button>
            ) : (
              <Link
                href={createProjectHref!}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" /></svg>
                </span>
                Project
              </Link>
            )
          )}
          {addPartnerHref && (
            <Link
              href={addPartnerHref}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              Add Partner
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
