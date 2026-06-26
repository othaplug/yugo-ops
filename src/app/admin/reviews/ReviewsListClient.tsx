"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { PageHeader } from "@/design-system/admin/layout";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { StatusPill } from "@/design-system/admin/primitives";

interface Review {
  id: string;
  move_id: string | null;
  move_code: string | null;
  scheduled_date: string | null;
  client_name: string | null;
  client_email: string | null;
  client_rating: number | null;
  client_feedback: string | null;
  status: string | null;
  source: string | null;
  platform: string | null;
  email_sent_at: string | null;
  sms_sent_at: string | null;
  reminder_sent_at: string | null;
  review_clicked: boolean | null;
  review_clicked_at: string | null;
  created_at: string;
}

type Filter = "all" | "rated" | "pending" | "low";

const STAR = "★";
const EMPTY = "☆";

function stars(n: number | null): string {
  const v = Number(n) || 0;
  return STAR.repeat(v) + EMPTY.repeat(Math.max(0, 5 - v));
}

function ratingTone(n: number | null): "success" | "warning" | "danger" | "neutral" {
  const v = Number(n) || 0;
  if (v === 0) return "neutral";
  if (v >= 4) return "success";
  if (v >= 3) return "warning";
  return "danger";
}

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google",
  internal: "Direct",
  other: "Other",
};

interface CompletedMove {
  id: string;
  move_code: string;
  client_name: string;
  client_email: string;
  scheduled_date: string;
}

// ── Move combobox ─────────────────────────────────────────────────────────────

function MoveCombobox({
  moves,
  selected,
  onSelect,
}: {
  moves: CompletedMove[];
  selected: CompletedMove | null;
  onSelect: (m: CompletedMove | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return moves.slice(0, 25);
    const q = query.toLowerCase();
    return moves
      .filter(
        (m) =>
          m.move_code.toLowerCase().includes(q) ||
          m.client_name.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [moves, query]);

  function pick(m: CompletedMove) {
    onSelect(m);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    onSelect(null);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--yu3-forest)] bg-[var(--yu3-forest)]/5 px-3 py-2">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[13px] font-semibold text-[var(--yu3-forest)]">
              {selected.move_code}
            </span>
            {selected.client_name && (
              <span className="ml-2 text-[12px] text-[var(--yu3-ink-muted)]">
                {selected.client_name}
              </span>
            )}
            {selected.scheduled_date && (
              <span className="ml-1 text-[11px] text-[var(--yu3-ink-muted)]">
                · {selected.scheduled_date}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] text-[16px] leading-none flex-shrink-0"
            aria-label="Clear move"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by move code or client name…"
          className="w-full rounded-lg border border-[var(--yu3-line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
          autoComplete="off"
        />
      )}

      {open && !selected && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--yu3-line)] bg-white shadow-lg max-h-52 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[var(--yu3-ink-muted)]">No moves found</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--yu3-bg-surface)] border-b border-[var(--yu3-line-subtle)] last:border-0"
              >
                <span className="font-mono text-[12px] font-semibold text-[var(--yu3-forest)]">
                  {m.move_code}
                </span>
                {m.client_name && (
                  <span className="ml-2 text-[12px] text-[var(--yu3-ink)]">{m.client_name}</span>
                )}
                {m.scheduled_date && (
                  <span className="ml-1 text-[11px] text-[var(--yu3-ink-muted)]">· {m.scheduled_date}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Review Modal ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  rating: 5,
  platform: "google" as "google" | "internal" | "other",
  client_name: "",
  client_email: "",
  move_code: "",
  feedback: "",
  review_date: new Date().toISOString().slice(0, 10),
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="text-[28px] leading-none transition-transform hover:scale-110"
          style={{ color: n <= (hovered || value) ? "#c8a84b" : "#d1d5db" }}
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-[13px] text-[var(--yu3-ink-muted)] self-center">
        {value}/5
      </span>
    </div>
  );
}

function AddReviewModal({
  onClose,
  onSaved,
  completedMoves,
}: {
  onClose: () => void;
  onSaved: () => void;
  completedMoves: CompletedMove[];
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedMove, setSelectedMove] = useState<CompletedMove | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleMoveSelect(m: CompletedMove | null) {
    setSelectedMove(m);
    if (m) {
      // Auto-fill client details only if the admin hasn't typed anything yet
      setForm((f) => ({
        ...f,
        move_code: m.move_code,
        client_name: f.client_name.trim() ? f.client_name : m.client_name,
        client_email: f.client_email.trim() ? f.client_email : m.client_email,
      }));
    } else {
      setForm((f) => ({ ...f, move_code: "" }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: form.rating,
          platform: form.platform,
          client_name: form.client_name.trim() || undefined,
          client_email: form.client_email.trim() || undefined,
          move_code: form.move_code.trim() || undefined,
          feedback: form.feedback.trim() || undefined,
          review_date: form.review_date || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--yu3-line-subtle)] flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)]">
              Operations
            </p>
            <h2 className="text-[18px] font-bold text-[var(--yu3-ink-strong)] mt-0.5">
              Log external review
            </h2>
            <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
              For reviews left directly on Google or another platform — not through the emailed link.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] text-[20px] leading-none mt-0.5 ml-4 flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Star rating */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1.5">
              Rating <span className="text-red-500">*</span>
            </label>
            <StarPicker value={form.rating} onChange={(n) => set("rating", n)} />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1.5">
              Platform
            </label>
            <div className="flex gap-2">
              {(["google", "internal", "other"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("platform", p)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${
                    form.platform === p
                      ? "bg-[var(--yu3-forest)] text-white border-[var(--yu3-forest)]"
                      : "bg-white text-[var(--yu3-ink-muted)] border-[var(--yu3-line)] hover:border-[var(--yu3-forest)]"
                  }`}
                >
                  {p === "google" ? "🔍 Google" : p === "internal" ? "Direct / Other" : "Other site"}
                </button>
              ))}
            </div>
          </div>

          {/* Client name + email row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1">
                Client name
              </label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="e.g. Sarah M. (can leave blank)"
                className="w-full rounded-lg border border-[var(--yu3-line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.client_email}
                onChange={(e) => set("client_email", e.target.value)}
                placeholder="optional"
                className="w-full rounded-lg border border-[var(--yu3-line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
              />
            </div>
          </div>

          {/* Move selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1">
              Move
            </label>
            <MoveCombobox
              moves={completedMoves}
              selected={selectedMove}
              onSelect={handleMoveSelect}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1">
              Date left
            </label>
            <input
              type="date"
              value={form.review_date}
              onChange={(e) => set("review_date", e.target.value)}
              className="w-full rounded-lg border border-[var(--yu3-line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
            />
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--yu3-ink-muted)] mb-1">
              What they wrote
            </label>
            <textarea
              value={form.feedback}
              onChange={(e) => set("feedback", e.target.value)}
              rows={3}
              placeholder="Paste the review text here (optional)"
              className="w-full rounded-lg border border-[var(--yu3-line)] px-3 py-2 text-[13px] leading-snug resize-none outline-none focus:border-[var(--yu3-forest)]"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold bg-[var(--yu3-forest)] text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewsListClient({
  reviews,
  completedMoves,
}: {
  reviews: Review[];
  completedMoves: CompletedMove[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const stats = useMemo(() => {
    const rated = reviews.filter((r) => Number(r.client_rating) > 0);
    const pending = reviews.filter(
      (r) => !r.client_rating && (r.status === "sent" || r.status === "reminded"),
    );
    const low = rated.filter((r) => Number(r.client_rating) <= 3);
    const sum = rated.reduce((s, r) => s + Number(r.client_rating || 0), 0);
    const avg = rated.length > 0 ? sum / rated.length : 0;
    return { total: reviews.length, rated: rated.length, pending: pending.length, low: low.length, avg };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (filter === "rated" && !Number(r.client_rating)) return false;
      if (filter === "pending") {
        if (r.client_rating) return false;
        if (r.status !== "sent" && r.status !== "reminded") return false;
      }
      if (filter === "low" && (!Number(r.client_rating) || Number(r.client_rating) > 3)) return false;
      if (q) {
        const hay = [r.client_name ?? "", r.client_email ?? "", r.move_code ?? "", r.client_feedback ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, filter, search]);

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {showAdd && (
        <AddReviewModal
          completedMoves={completedMoves}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}

      <PageHeader
        eyebrow="Operations"
        title="Client reviews"
        description="Post-move client reviews. Crew sign-off ratings live on /admin/crew/analytics — those are a separate on-tablet score and tend to read higher."
      />

      <KpiStrip
        tiles={[
          {
            id: "avg",
            label: "Average rating",
            value: stats.rated > 0 ? stats.avg.toFixed(1) : "—",
            hint: `${stats.rated} of ${stats.total} reviewed`,
          },
          {
            id: "pending",
            label: "Pending",
            value: String(stats.pending),
            hint: "sent / reminded, awaiting rating",
          },
          {
            id: "low",
            label: "3★ or less",
            value: String(stats.low),
            hint: "needs follow-up",
          },
        ]}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "rated", "pending", "low"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition ${
              filter === f
                ? "bg-[var(--yu3-forest)] text-white"
                : "bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-line-subtle)]"
            }`}
          >
            {f === "low" ? "Low (≤3★)" : f}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--yu3-forest)] text-white hover:opacity-90 transition"
        >
          <span className="text-[15px] leading-none">+</span>
          Add review
        </button>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, move, feedback…"
          className="w-72 rounded-lg border border-[var(--yu3-line)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--yu3-line)] bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[var(--yu3-bg-surface)] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--yu3-ink-muted)]">
              <th className="text-left px-4 py-2.5">Rating</th>
              <th className="text-left px-4 py-2.5">Client</th>
              <th className="text-left px-4 py-2.5">Move</th>
              <th className="text-left px-4 py-2.5">Feedback</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[var(--yu3-ink-muted)]">
                  No reviews match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isManual = r.source === "manual";
                return (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--yu3-line-subtle)] hover:bg-[var(--yu3-bg-surface)]"
                  >
                    <td className="px-4 py-3">
                      {r.client_rating != null && Number(r.client_rating) > 0 ? (
                        <div className="flex items-center gap-2">
                          <StatusPill tone={ratingTone(r.client_rating)}>
                            {Number(r.client_rating)}/5
                          </StatusPill>
                          <span className="text-[14px] tracking-tight" aria-hidden>
                            {stars(r.client_rating)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--yu3-ink-muted)] text-[12px]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--yu3-ink-strong)]">
                        {r.client_name || "—"}
                      </div>
                      {r.client_email && (
                        <div className="text-[11px] text-[var(--yu3-ink-muted)]">{r.client_email}</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.move_id ? (
                        <Link
                          href={`/admin/moves/${r.move_code || r.move_id}`}
                          className="text-[var(--yu3-forest)] hover:underline font-medium"
                        >
                          {r.move_code || "view"}
                        </Link>
                      ) : (
                        <span className="text-[var(--yu3-ink-muted)]">—</span>
                      )}
                      {r.scheduled_date && (
                        <div className="text-[11px] text-[var(--yu3-ink-muted)]">{r.scheduled_date}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-[360px]">
                      {r.client_feedback ? (
                        <p className="text-[var(--yu3-ink)] leading-snug whitespace-pre-wrap">
                          &ldquo;{r.client_feedback}&rdquo;
                        </p>
                      ) : (
                        <span className="text-[var(--yu3-ink-muted)] text-[12px]">
                          {Number(r.client_rating) > 0 ? "No written feedback" : "Awaiting response"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isManual ? (
                        <>
                          <StatusPill tone="neutral">
                            {PLATFORM_LABELS[r.platform ?? ""] ?? "Manual"}
                          </StatusPill>
                          <div className="text-[10px] text-[var(--yu3-ink-muted)] mt-1">
                            logged by admin
                          </div>
                        </>
                      ) : (
                        <>
                          <StatusPill
                            tone={
                              r.status === "sent" || r.status === "reminded"
                                ? "warning"
                                : r.client_rating
                                ? "success"
                                : "neutral"
                            }
                          >
                            {r.status || "—"}
                          </StatusPill>
                          {r.review_clicked && (
                            <div className="text-[10px] text-[var(--yu3-ink-muted)] mt-1">
                              clicked the link
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[12px] text-[var(--yu3-ink-muted)] whitespace-nowrap">
                      {formatAdminCreatedAt(r.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-[var(--yu3-ink-muted)]">
        Showing {filtered.length} of {reviews.length} review request{reviews.length === 1 ? "" : "s"}.
        Last 500 only — older reviews are paginated server-side in a later pass.
      </p>
    </div>
  );
}
