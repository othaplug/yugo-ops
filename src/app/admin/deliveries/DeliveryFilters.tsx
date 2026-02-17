"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "../components/Badge";
import { Icon } from "@/components/AppIcons";
import { formatMoveDate } from "@/lib/date-format";
import { getDeliveryDetailPath } from "@/lib/move-code";

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

export default function DeliveryFilters({
  deliveries,
  today,
}: {
  deliveries: Delivery[];
  today: string;
}) {
  const [filter, setFilter] = useState<"all" | "today" | "pending">("all");

  const filtered =
    filter === "today"
      ? deliveries.filter((d) => d.scheduled_date === today)
      : filter === "pending"
      ? deliveries.filter((d) => d.status === "pending")
      : deliveries;

  const tabs = [
    { key: "all" as const, label: `All (${deliveries.length})` },
    { key: "today" as const, label: "Today" },
    { key: "pending" as const, label: "Pending" },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-[var(--brd)] mb-3">
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

      {/* Delivery List */}
      <div className="flex flex-col gap-1">
        {filtered.map((d) => (
          <Link
            key={d.id}
            href={getDeliveryDetailPath(d)}
            className="flex items-center gap-2 sm:gap-2.5 px-3 py-3 sm:py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] active:bg-[var(--gdim)] transition-all min-h-[52px] touch-manipulation"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--tx2)] shrink-0 ${
                CATEGORY_BGS[d.category] || "bg-[var(--gdim)]"
              }`}
            >
              <Icon name={CATEGORY_ICONS[d.category] || "package"} className="w-[16px] h-[16px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold break-words line-clamp-2">
                {d.customer_name} ({d.client_name})
              </div>
              <div className="text-[9px] text-[var(--tx3)] truncate max-w-[200px] sm:max-w-none">
                {d.items?.length || 0} items • {d.delivery_number}
              </div>
            </div>
            <div className="hidden sm:block text-[10px] text-[var(--tx3)] shrink-0 text-right">
              <div>{formatMoveDate(d.scheduled_date)}</div>
              <div>{d.time_slot}</div>
            </div>
            <div className="sm:hidden text-[9px] text-[var(--tx3)] shrink-0">{formatMoveDate(d.scheduled_date)}</div>
            <Badge status={d.status} />
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
            No deliveries {filter === "today" ? "today" : filter === "pending" ? "pending" : "yet"}
          </div>
        )}
      </div>
    </>
  );
}