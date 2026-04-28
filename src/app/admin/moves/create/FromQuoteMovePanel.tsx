"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { StatusPill } from "@/design-system/admin/primitives";
import { useToast } from "../../components/Toast";

type QuoteRow = {
  id: string;
  quote_id: string;
  client_name: string;
  service_type: string;
  tiers: Record<string, { price?: number; total?: number }> | null;
  custom_price: number | null;
  selected_tier: string | null;
  recommended_tier: string | null;
  move_date: string | null;
  from_address: string | null;
  to_address: string | null;
};

function quoteTierLabel(q: QuoteRow): string {
  const t = q.selected_tier || q.recommended_tier || "";
  if (!t) return "Tier";
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

function quotePrice(q: QuoteRow): number | null {
  const tierKey = q.selected_tier || q.recommended_tier;
  const tiers = q.tiers;
  if (tierKey && tiers && tierKey in tiers) {
    const row = tiers[tierKey];
    const n = Number(row?.price ?? row?.total ?? 0);
    return n > 0 ? n : null;
  }
  const c = q.custom_price;
  return c != null && Number(c) > 0 ? Number(c) : null;
}

export default function FromQuoteMovePanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [quotes, setQuotes] = React.useState<QuoteRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creatingId, setCreatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const q = encodeURIComponent(search.trim());
          const res = await fetch(
            `/api/admin/quotes/convertible-for-move${q ? `?q=${q}` : ""}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load quotes");
          if (!cancelled) setQuotes(data.quotes || []);
        } catch (e) {
          if (!cancelled)
            toast(e instanceof Error ? e.message : "Could not load quotes", "x");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, toast]);

  const handleConvert = async (quoteUuid: string, quotePublicId: string) => {
    setCreatingId(quoteUuid);
    try {
      const res = await fetch("/api/admin/quotes/recover-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quotePublicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");

      const moveCode = typeof data.move_code === "string" ? data.move_code : "";
      toast(
        data.message?.includes?.("already exists")
          ? "Move already linked to this quote"
          : "Move created from quote",
        "check",
      );

      const path =
        typeof data.move_id === "string" && data.move_id.trim()
          ? `/admin/moves/${data.move_id.trim()}`
          : `/admin/moves`;

      router.push(path);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Conversion failed", "x");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl min-w-0">
      <p className="text-[13px] text-[var(--yu3-ink-muted)] leading-relaxed">
        Choose an accepted quote that does not have a linked move yet. We create the move using the quote contract and payout path.
      </p>
      <label className="block">
        <span className="sr-only">Search quotes</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client name, quote ID, or address"
          autoComplete="off"
          className="admin-premium-input w-full text-[13px]"
        />
      </label>

      {loading ? (
        <p className="text-[13px] text-[var(--yu3-ink-muted)] py-6 text-center">
          Loading quotes…
        </p>
      ) : quotes.length === 0 ? (
        <p className="text-[13px] text-[var(--yu3-ink-muted)] py-8 text-center leading-relaxed">
          No accepted quotes waiting for a move. Quotes must be accepted and cannot already have a move.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Quotes ready for conversion">
          {quotes.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                disabled={creatingId !== null}
                aria-busy={creatingId === q.id ? true : undefined}
                onClick={() => void handleConvert(q.id, q.quote_id)}
                className="w-full rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 text-left hover:border-[var(--yu3-wine)]/35 transition-colors shadow-[var(--yu3-shadow-sm)] disabled:opacity-60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                      {q.client_name || "Unnamed"}
                    </div>
                    <div className="text-[11px] text-[var(--yu3-ink-muted)] mt-1 leading-relaxed">
                      {quoteRefLabel(q.quote_id)}
                      {" · "}
                      {serviceTypeDisplayLabel(q.service_type)}
                      {" · "}
                      {quoteTierLabel(q)}
                      {q.move_date ? ` · ${formatMoveDate(q.move_date)}` : ""}
                    </div>
                    <div className="text-[11px] text-[var(--yu3-ink-muted)] mt-1 truncate">
                      {q.from_address || "?"}
                      {" → "}
                      {q.to_address || "?"}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-[13px] font-semibold tabular-nums text-[var(--yu3-ink-strong)]">
                      {quotePrice(q) != null ? formatCurrency(quotePrice(q)!) : ""}
                    </div>
                    <StatusPill tone="success">
                      Accepted
                    </StatusPill>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => router.push("/admin/quotes")}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] w-fit"
      >
        <ArrowLeft size={14} aria-hidden />
        Quotes list
      </button>
    </div>
  );
}

function quoteRefLabel(publicId: string): string {
  const s = (publicId || "").trim();
  return s.startsWith("#") ? s : `#${s}`;
}
