"use client";

import { useState } from "react";
import {
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
} from "@phosphor-icons/react";

interface EditSectionProps {
  /** Short title shown in the header (e.g. "Route & access") */
  title: string;
  /** One-line summary shown when collapsed (e.g. "55 Cooper St → 28 Eastern Ave · Jul 1, 2026") */
  summary?: React.ReactNode;
  /** Optional small label above the title (e.g. "PRICING") */
  eyebrow?: string;
  /** Default collapsed state. Defaults to true. */
  defaultOpen?: boolean;
  /** When true, shows a gold dot indicating this section has unsaved changes. */
  hasChanges?: boolean;
  /** Optional ID for deep-linking / programmatic open. */
  id?: string;
  children: React.ReactNode;
}

/**
 * Edit-page accordion section. Wraps a logical block of form fields with
 * a header that shows a one-line summary while collapsed, and the full
 * field group while open. Designed to live on /admin/quotes/[id]/edit.
 *
 * Keeps each section's edit affordance discoverable without the whole
 * page being one 2,900-line wall of fields. Differs from the generic
 * `CollapsibleSection` by surfacing a right-aligned summary, a change
 * indicator dot, and an eyebrow label.
 */
export default function EditSection({
  title,
  summary,
  eyebrow,
  defaultOpen = false,
  hasChanges = false,
  id,
  children,
}: EditSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      id={id}
      className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[var(--bg)]/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase mb-0.5">
              {eyebrow}
            </div>
          )}
          <div className="flex items-baseline gap-3">
            <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] shrink-0 flex items-center gap-2">
              {title}
              {hasChanges && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gold)]"
                  aria-label="unsaved changes"
                  title="Unsaved changes in this section"
                />
              )}
            </h3>
            {!open && summary && (
              <span className="text-[11px] text-[var(--tx3)] truncate min-w-0">
                {summary}
              </span>
            )}
          </div>
        </div>

        <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--tx3)] shrink-0">
          {open ? "Hide" : "Edit"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[var(--brd)]">
          {children}
        </div>
      )}
    </div>
  );
}
