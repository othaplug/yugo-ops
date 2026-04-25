"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createButtonBaseClass } from "./CreateButton";
import {
  BookOpen,
  CalendarBlank,
  Handshake,
  Plus,
  Truck,
  UsersThree,
} from "@phosphor-icons/react";

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

export default function CreateDeliveryDropdown({
  type,
  createProjectHref,
  createProjectOnClick,
  addPartnerHref,
  className = "",
}: CreateDeliveryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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
        <Plus size={16} weight="regular" className="text-current" aria-hidden />
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
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
              <Truck
                size={14}
                weight="regular"
                className="text-current"
                aria-hidden
              />
            </span>
            Delivery
          </Link>
          <Link
            href={dayRateUrl}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
              <CalendarBlank
                size={14}
                weight="regular"
                className="text-current"
                aria-hidden
              />
            </span>
            Day Rate
          </Link>
          <Link
            href={b2bOneOffUrl}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
              <Handshake
                size={14}
                weight="regular"
                className="text-current"
                aria-hidden
              />
            </span>
            B2B One-Off
          </Link>
          {(createProjectHref || createProjectOnClick) &&
            (createProjectOnClick ? (
              <button
                type="button"
                onClick={() => {
                  createProjectOnClick();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors w-full text-left first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
                  <BookOpen
                    size={14}
                    weight="regular"
                    className="text-current"
                    aria-hidden
                  />
                </span>
                Project
              </button>
            ) : (
              <Link
                href={createProjectHref!}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
                  <BookOpen
                    size={14}
                    weight="regular"
                    className="text-current"
                    aria-hidden
                  />
                </span>
                Project
              </Link>
            ))}
          {addPartnerHref && (
            <Link
              href={addPartnerHref}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--tx)] hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--accent-text)]">
                <UsersThree
                  size={14}
                  weight="regular"
                  className="text-current"
                  aria-hidden
                />
              </span>
              Add Partner
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
