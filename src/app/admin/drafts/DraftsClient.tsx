"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClockCounterClockwise,
  Trash,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  getAllDraftMetas,
  deleteDraft,
  clearAllDrafts,
  getDraftLabel,
  type DraftMeta,
} from "@/hooks/useFormDraft";

const TYPE_COLORS: Record<string, string> = {
  delivery: "text-blue-700 dark:text-blue-400",
  delivery_b2b: "text-purple-700 dark:text-purple-400",
  delivery_dayrate: "text-indigo-700 dark:text-indigo-400",
  move: "text-emerald-700 dark:text-emerald-400",
  quote: "text-amber-700 dark:text-amber-400",
  project: "text-rose-700 dark:text-rose-400",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DraftsClient() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDrafts(getAllDraftMetas());
    setMounted(true);
  }, []);

  const handleDelete = (id: string) => {
    deleteDraft(id);
    setDrafts(getAllDraftMetas());
  };

  const handleClearAll = () => {
    clearAllDrafts();
    setDrafts([]);
  };

  if (!mounted) {
    return (
      <div className="p-6">
        <h1 className="admin-page-hero text-[var(--tx)]">Drafts</h1>
        <p className="text-[13px] text-[var(--tx3)] mt-1">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="admin-page-hero text-[var(--tx)]">Drafts</h1>
          <p className="text-[13px] text-[var(--tx3)] mt-0.5">
            Forms auto-save as you type. Resume any unfinished work below.
          </p>
        </div>
        {drafts.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--red)] hover:bg-red-500/10 border border-[var(--brd)] transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[15px] font-semibold text-[var(--tx2)]">
            No drafts saved
          </p>
          <p className="text-[12px] text-[var(--tx3)] mt-1 max-w-sm">
            When you start filling out a form and leave before submitting, it
            will automatically be saved here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--brd)]/50">
          {drafts.map((draft) => (
            <div key={draft.id} className="flex items-center gap-3 py-3">
              <ClockCounterClockwise
                size={18}
                className="text-[var(--accent-text)] shrink-0"
                aria-hidden
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-[var(--tx)] truncate">
                    {draft.title}
                  </span>
                  <span
                    className={`dt-badge tracking-[0.04em] ${TYPE_COLORS[draft.formType] ?? "text-[var(--tx3)]"}`}
                  >
                    {getDraftLabel(draft.formType)}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--tx3)]">
                  Last edited {formatRelativeTime(draft.updatedAt)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="p-2 rounded-lg text-[var(--tx3)] hover:text-[var(--red)] hover:bg-red-500/10 transition-colors"
                  title="Delete draft"
                >
                  <Trash size={14} />
                </button>
                <Link
                  href={draft.path}
                  className="admin-btn admin-btn-sm admin-btn-primary"
                >
                  Resume <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
