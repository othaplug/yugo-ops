"use client";

import { useState, useMemo } from "react";
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

function ratingTone(
  n: number | null,
): "success" | "warning" | "danger" | "neutral" {
  const v = Number(n) || 0;
  if (v === 0) return "neutral";
  if (v >= 4) return "success";
  if (v >= 3) return "warning";
  return "danger";
}

export default function ReviewsListClient({ reviews }: { reviews: Review[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const rated = reviews.filter((r) => Number(r.client_rating) > 0);
    const pending = reviews.filter(
      (r) => !r.client_rating && (r.status === "sent" || r.status === "reminded"),
    );
    const low = rated.filter((r) => Number(r.client_rating) <= 3);
    const sum = rated.reduce((s, r) => s + Number(r.client_rating || 0), 0);
    const avg = rated.length > 0 ? sum / rated.length : 0;
    return {
      total: reviews.length,
      rated: rated.length,
      pending: pending.length,
      low: low.length,
      avg,
    };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      // filter
      if (filter === "rated" && !Number(r.client_rating)) return false;
      if (filter === "pending") {
        if (r.client_rating) return false;
        if (r.status !== "sent" && r.status !== "reminded") return false;
      }
      if (filter === "low" && (!Number(r.client_rating) || Number(r.client_rating) > 3))
        return false;
      // search
      if (q) {
        const hay = [
          r.client_name ?? "",
          r.client_email ?? "",
          r.move_code ?? "",
          r.client_feedback ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, filter, search]);

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, move, feedback…"
          className="ml-auto w-72 rounded-lg border border-[var(--yu3-line)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--yu3-forest)]"
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
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-[var(--yu3-line-subtle)] hover:bg-[var(--yu3-bg-surface)]">
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
                      <div className="text-[11px] text-[var(--yu3-ink-muted)]">
                        {r.client_email}
                      </div>
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
                      <div className="text-[11px] text-[var(--yu3-ink-muted)]">
                        {r.scheduled_date}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[360px]">
                    {r.client_feedback ? (
                      <p className="text-[var(--yu3-ink)] leading-snug whitespace-pre-wrap">
                        &ldquo;{r.client_feedback}&rdquo;
                      </p>
                    ) : (
                      <span className="text-[var(--yu3-ink-muted)] text-[12px]">
                        {Number(r.client_rating) > 0
                          ? "No written feedback"
                          : "Awaiting response"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--yu3-ink-muted)] whitespace-nowrap">
                    {formatAdminCreatedAt(r.created_at)}
                  </td>
                </tr>
              ))
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
