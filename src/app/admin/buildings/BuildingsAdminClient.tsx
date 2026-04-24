"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Buildings, MagnifyingGlass } from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

type Row = {
  id: string;
  address: string;
  building_name: string | null;
  complexity_rating: number | null;
  verified: boolean | null;
  times_moved_here: number | null;
  last_move_date: string | null;
  updated_at: string | null;
  elevator_system?: string | null;
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "Never";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BuildingsAdminClient({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const u = new URL("/api/admin/buildings", window.location.origin);
      if (query.trim().length >= 2) u.searchParams.set("q", query.trim());
      const res = await fetch(u.toString());
      const data = await res.json();
      if (Array.isArray(data.buildings)) setRows(data.buildings);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(q);
    }, 320);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const flagged = rows.filter((r) => (r.complexity_rating ?? 1) >= 4).length;
  const unverified = rows.filter((r) => !r.verified).length;

  return (
    <PageContent>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-heading font-semibold text-[var(--tx)] tracking-tight flex items-center gap-2">
              <Buildings className="text-[var(--tx2)]" size={24} weight="regular" />
              Buildings
            </h1>
            <p className="text-[13px] text-[var(--tx2)] mt-1 leading-relaxed">
              Institutional access notes for quoting and crew planning.
            </p>
          </div>
          <Link
            href="/admin/buildings/new"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--yu3-wine)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-on-wine)] shadow-sm transition-colors hover:bg-[var(--yu3-wine-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]"
          >
            Add building
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
              High complexity (4–5)
            </p>
            <p className="text-2xl font-heading font-semibold text-[var(--tx)] mt-1">{flagged}</p>
          </div>
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
              Unverified
            </p>
            <p className="text-2xl font-heading font-semibold text-[var(--tx)] mt-1">{unverified}</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]"
            size={16}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search address or building name"
            className="w-full rounded-lg border border-[var(--brd)] bg-[var(--card)] pl-9 pr-3 py-2.5 text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
          {loading ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--tx3)]">
              …
            </span>
          ) : null}
        </div>

        <ul className="space-y-2">
          {rows.map((b) => (
            <li key={b.id}>
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-4 py-3 hover:border-[var(--tx3)]/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/buildings/${b.id}`} className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-[var(--tx3)] uppercase tracking-wide">
                      {b.complexity_rating != null ? `Complexity ${b.complexity_rating}` : "Unrated"}
                      {!b.verified ? " · Unverified" : ""}
                    </p>
                    <p className="text-[14px] font-medium text-[var(--tx)] mt-0.5 truncate">
                      {b.building_name || b.address}
                    </p>
                    <p className="text-[12px] text-[var(--tx2)] mt-0.5 line-clamp-2">
                      {b.address}
                    </p>
                    {b.elevator_system ? (
                      <p className="text-[11px] text-[var(--tx3)] mt-1">
                        Elevator: {b.elevator_system.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </Link>
                  <div className="text-right shrink-0 text-[11px] text-[var(--tx3)] space-y-1">
                    <p>Last move: {fmtDate(b.last_move_date)}</p>
                    <p>{b.times_moved_here ?? 0} moves logged</p>
                    <Link
                      href={`/admin/moves?q=${encodeURIComponent(b.address)}`}
                      className="inline-block mt-1 text-[11px] font-semibold text-[var(--tx)] underline underline-offset-2 hover:text-[var(--tx2)]"
                    >
                      View moves
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {rows.length === 0 ? (
          <p className="text-[13px] text-[var(--tx2)] text-center py-8">No buildings match.</p>
        ) : null}
      </div>
    </PageContent>
  );
}
