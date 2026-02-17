"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "../components/Badge";
import { Icon } from "@/components/AppIcons";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Delivery {
  id: string;
  delivery_number: string;
  client_name: string;
  customer_name: string;
  items: string[];
  scheduled_date: string;
  time_slot: string;
  status: string;
  category: string;
}

interface Move {
  id: string;
  client_name: string;
  from_address?: string | null;
  to_address?: string | null;
  delivery_address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status: string;
  move_type: string;
  estimate?: number | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  retail: "sofa",
  designer: "palette",
  hospitality: "hotel",
  gallery: "image",
};

const CATEGORY_BGS: Record<string, string> = {
  retail: "bg-[var(--gdim)]",
  designer: "bg-[var(--prdim)]",
  hospitality: "bg-[var(--ordim)]",
  gallery: "bg-[var(--bldim)]",
};

export default function AllProjectsView({
  deliveries,
  moves,
  today,
}: {
  deliveries: Delivery[];
  moves: Move[];
  today: string;
}) {
  const [filter, setFilter] = useState<"all" | "today" | "pending">("all");
  const [b2bExpanded, setB2bExpanded] = useState(true);
  const [movesExpanded, setMovesExpanded] = useState(true);

  const isToday = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    if (dateStr === today) return true;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10) === today;
    const match = dateStr.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d+)/i);
    const todayDay = parseInt(today.slice(8, 10), 10);
    return match ? parseInt(match[1], 10) === todayDay : false;
  };

  const filteredDeliveries =
    filter === "today"
      ? deliveries.filter((d) => d.scheduled_date === today)
      : filter === "pending"
        ? deliveries.filter((d) => d.status === "pending")
        : deliveries;

  const filteredMoves =
    filter === "today"
      ? moves.filter((m) => isToday(m.scheduled_date))
      : filter === "pending"
        ? moves.filter((m) => m.status === "pending")
        : moves;

  const totalCount = deliveries.length + moves.length;
  const todayCount = deliveries.filter((d) => d.scheduled_date === today).length + moves.filter((m) => isToday(m.scheduled_date)).length;
  const pendingCount = deliveries.filter((d) => d.status === "pending").length + moves.filter((m) => m.status === "pending").length;

  const tabs = [
    { key: "all" as const, label: `All (${totalCount})` },
    { key: "today" as const, label: `Today (${todayCount})` },
    { key: "pending" as const, label: `Pending (${pendingCount})` },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-[var(--brd)] mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 text-center py-[7px] text-[10px] font-bold border-b-2 transition-all cursor-pointer
              ${filter === tab.key
                ? "text-[var(--gold)] border-[var(--gold)]"
                : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* B2B Partner Projects - collapsible section */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setB2bExpanded((e) => !e)}
          className="w-full flex items-center gap-2 py-3 px-3 rounded-t-xl bg-[var(--card)] border border-b-0 border-[var(--brd)] hover:bg-[var(--gdim)]/50 transition-all group"
        >
          {b2bExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" />
          )}
          <span className="font-heading text-[12px] font-bold text-[var(--tx)]">B2B Partner Projects</span>
          <span className="text-[10px] text-[var(--tx3)] font-medium">({filteredDeliveries.length})</span>
        </button>
        {b2bExpanded && (
          <div className="flex flex-col gap-1 border border-t-0 border-[var(--brd)] rounded-b-xl p-2 pt-0 bg-[var(--card)]">
            {filteredDeliveries.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] rounded-lg bg-[var(--bg)]/50">
                No B2B projects {filter === "today" ? "today" : filter === "pending" ? "pending" : "yet"}
              </div>
            ) : (
              filteredDeliveries.map((d) => (
                <Link
                  key={d.id}
                  href={`/admin/deliveries/${d.id}`}
                  className="flex items-center gap-2 sm:gap-2.5 px-3 py-3 sm:py-2.5 bg-[var(--bg)]/30 border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] active:bg-[var(--gdim)] transition-all min-h-[52px] touch-manipulation"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--tx2)] shrink-0 ${
                      CATEGORY_BGS[d.category] || "bg-[var(--gdim)]"
                    }`}
                  >
                    <Icon name={CATEGORY_ICONS[d.category] || "package"} className="w-[16px] h-[16px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">
                      {d.customer_name} ({d.client_name})
                    </div>
                    <div className="text-[9px] text-[var(--tx3)] truncate">
                      {d.items?.length || 0} items • {d.delivery_number}
                    </div>
                  </div>
                  <div className="hidden sm:block text-[10px] text-[var(--tx3)] shrink-0 text-right">
                    <div>{d.scheduled_date}</div>
                    <div>{d.time_slot}</div>
                  </div>
                  <div className="sm:hidden text-[9px] text-[var(--tx3)] shrink-0">{d.scheduled_date}</div>
                  <Badge status={d.status} />
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* All Moves - collapsible section */}
      <div>
        <button
          type="button"
          onClick={() => setMovesExpanded((e) => !e)}
          className="w-full flex items-center gap-2 py-3 px-3 rounded-t-xl bg-[var(--card)] border border-b-0 border-[var(--brd)] hover:bg-[var(--gdim)]/50 transition-all group"
        >
          {movesExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" />
          )}
          <span className="font-heading text-[12px] font-bold text-[var(--tx)]">All Moves</span>
          <span className="text-[10px] text-[var(--tx3)] font-medium">({filteredMoves.length})</span>
        </button>
        {movesExpanded && (
          <div className="flex flex-col gap-1 border border-t-0 border-[var(--brd)] rounded-b-xl p-2 pt-0 bg-[var(--card)]">
            {filteredMoves.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] rounded-lg bg-[var(--bg)]/50">
                No moves {filter === "today" ? "today" : filter === "pending" ? "pending" : "yet"}
              </div>
            ) : (
              filteredMoves.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/moves/${m.id}`}
                  className="flex items-center gap-2 sm:gap-2.5 px-3 py-3 sm:py-2.5 bg-[var(--bg)]/30 border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] active:bg-[var(--gdim)] transition-all min-h-[52px] touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] shrink-0 text-[var(--tx2)]">
                    <Icon name={m.move_type === "office" ? "building" : "home"} className="w-[16px] h-[16px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">{m.client_name}</div>
                    <div className="text-[9px] text-[var(--tx3)] truncate">
                      {m.from_address || "—"} → {m.to_address || m.delivery_address || "—"}
                    </div>
                  </div>
                  <div className="hidden sm:block text-[10px] text-[var(--tx3)] shrink-0 text-right">
                    <div>{m.scheduled_date || "—"}</div>
                    <div className="text-[var(--gold)] font-semibold">${Number(m.estimate || 0).toLocaleString()}</div>
                  </div>
                  <div className="sm:hidden text-[9px] text-[var(--tx3)] shrink-0">{m.scheduled_date || "—"}</div>
                  <Badge status={m.status} />
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
