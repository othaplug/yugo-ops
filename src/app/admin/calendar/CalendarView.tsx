"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import GlobalModal from "@/components/ui/Modal";
import UpcomingItem from "./UpcomingItem";

interface CalendarViewProps {
  deliveries: any[];
  moves: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  retail: "#C9A962",
  designer: "#C9A962",
  hospitality: "#D48A29",
  gallery: "#4A7CE5",
  b2c: "#2D9F5A",
};

export default function CalendarView({ deliveries, moves }: CalendarViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"delivery" | "move" | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [summaryModal, setSummaryModal] = useState<"total" | "b2b" | "b2c" | "unassigned" | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate week days - use current week as base
  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setDate(now.getDate() - now.getDay());
  const weekStart = new Date(baseDate);
  weekStart.setDate(baseDate.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getEventsForDay = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const dayNum = date.getDate();

    const dels = deliveries.filter((d) => {
      if (d.scheduled_date === dateStr) return true;
      // Also match "Feb X" format
      const match = d.scheduled_date?.match(/Feb\s*(\d+)/);
      return match && parseInt(match[1]) === dayNum;
    });

    const mvs = moves.filter((m) => {
      if (m.scheduled_date === dateStr) return true;
      const match = m.scheduled_date?.match(/Feb\s*(\d+)/);
      return match && parseInt(match[1]) === dayNum;
    });

    return { dels, mvs };
  };

  const handleDrop = async (date: Date) => {
    if (!dragId || !dragType) return;
    const dateStr = date.toISOString().split("T")[0];

    if (dragType === "delivery") {
      await supabase
        .from("deliveries")
        .update({ scheduled_date: dateStr })
        .eq("id", dragId);
    } else {
      await supabase
        .from("moves")
        .update({ scheduled_date: `Feb ${date.getDate()}` })
        .eq("id", dragId);
    }

    setDragId(null);
    setDragType(null);
    router.refresh();
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return date.toDateString() === now.toDateString();
  };

  // Highlight first day of visible week when swiping/navigating
  useEffect(() => {
    const base = new Date("2026-02-09");
    const start = new Date(base);
    start.setDate(base.getDate() + weekOffset * 7);
    setSelectedDate(start.toISOString().split("T")[0]);
  }, [weekOffset]);

  const unassigned = deliveries.filter((d) => !d.crew_id).length;
  const totalWeek = days.reduce((sum, day) => {
    const { dels, mvs } = getEventsForDay(day);
    return sum + dels.length + mvs.length;
  }, 0);

  const deliveriesThisWeek = days.flatMap((day) => getEventsForDay(day).dels);
  const movesThisWeek = days.flatMap((day) => getEventsForDay(day).mvs);

  return (
    <>
      {/* Week Header - responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
        <div className="flex gap-1.5">
          <Link href="/admin/deliveries/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all">
            + Schedule Job
          </Link>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all touch-manipulation">◀</button>
          <span className="text-[11px] sm:text-[13px] font-bold text-center">
            {weekStart.toLocaleDateString("en-US", { month: "long" })} {weekStart.getDate()} – {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).getDate()}, {weekStart.getFullYear()}
          </span>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all touch-manipulation">▶</button>
        </div>
      </div>

      {/* Day Headers - highlighted when in view, better mobile spacing */}
      <div className="grid grid-cols-7 gap-1 sm:gap-[3px] mb-2">
        {days.map((day) => {
          const dateStr = day.toISOString().split("T")[0];
          const today = isToday(day);
          const isSelected = selectedDate === dateStr;
          return (
            <div
              key={day.toISOString()}
              className={`text-center text-[8px] font-bold uppercase tracking-wider transition-colors py-1 rounded ${
                today ? "text-[var(--gold)] bg-[var(--gdim)]/50" : isSelected ? "text-[var(--gold)] bg-[var(--gdim)]/30" : "text-[var(--tx3)] bg-[var(--gdim)]/20"
              }`}
            >
              {day.toLocaleDateString("en-US", { weekday: "short" })} {day.getDate()}
              {today && (
                <span className="ml-1 bg-[var(--gdim)] px-1 py-[1px] rounded text-[7px]">TODAY</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Calendar Grid - whole cell clickable, touch swipe, better mobile */}
      <div
        ref={gridRef}
        className="grid grid-cols-7 gap-1 sm:gap-[3px] select-none"
        style={{ minHeight: 320 }}
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart === null) return;
          const diff = touchStart - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) {
            setWeekOffset((o) => (diff > 0 ? o + 1 : o - 1));
          }
          setTouchStart(null);
        }}
      >
        {days.map((day) => {
          const { dels, mvs } = getEventsForDay(day);
          const today = isToday(day);
          const dateStr = day.toISOString().split("T")[0];
          const isSelected = selectedDate === dateStr;

          const handleCellClick = () => {
            router.push(`/admin/deliveries/new?date=${dateStr}`);
            setSelectedDate(dateStr);
          };

          return (
            <div
              key={day.toISOString()}
              className={`bg-[var(--card)] border rounded-lg p-2 sm:p-1.5 min-h-[100px] sm:min-h-[120px] transition-all cursor-pointer hover:border-[var(--gold)]/50 ${
                today ? "border-[var(--gold)] bg-[var(--gdim)]/30" : "border-[var(--brd)]"
              } ${isSelected ? "ring-2 ring-[var(--gold)]/40 ring-inset" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(day)}
              onClick={handleCellClick}
            >
              {dels.map((d) => {
                const color = CATEGORY_COLORS[d.category] || CATEGORY_COLORS.retail;
                return (
                  <div
                    key={d.id}
                    data-event-card
                    draggable
                    onDragStart={() => { setDragId(d.id); setDragType("delivery"); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(getDeliveryDetailPath(d));
                    }}
                    className="px-1.5 py-1 rounded mb-[3px] cursor-pointer transition-all hover:opacity-80"
                    style={{ borderLeft: `3px solid ${color}`, background: `${color}11` }}
                  >
                    <div className="text-[9px] font-bold truncate" style={{ color }}>
                      {d.customer_name}
                    </div>
                    <div className="text-[8px] text-[var(--tx3)]">
                      {d.time_slot}
                    </div>
                  </div>
                );
              })}

              {mvs.map((m) => (
                <div
                  key={m.id}
                  data-event-card
                  draggable
                  onDragStart={() => { setDragId(m.id); setDragType("move"); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(getMoveDetailPath(m));
                  }}
                  className="px-1.5 py-1 rounded mb-[3px] cursor-pointer transition-all hover:opacity-80"
                  style={{ borderLeft: `3px solid #2D9F5A`, background: `#2D9F5A11` }}
                >
                  <div className="text-[9px] font-bold truncate text-[#2D9F5A] flex items-center gap-1">
                    <Icon name="home" className="w-[10px] h-[10px]" /> {m.client_name}
                  </div>
                  <div className="text-[8px] text-[var(--tx3)]">{m.time || ""}</div>
                </div>
              ))}

              {dels.length === 0 && mvs.length === 0 && (
                <div className="w-full text-center py-5 text-[var(--tx3)] text-[8px]">
                  + Schedule job
                </div>
              )}

              <div className="text-center text-[8px] text-[var(--tx3)] opacity-40 mt-1">+ drop here</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        {[
          ["Retail", "#C9A962"],
          ["Designer", "#C9A962"],
          ["Hospitality", "#D48A29"],
          ["B2C Move", "#2D9F5A"],
        ].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1 text-[9px] text-[var(--tx3)]">
            <div className="w-2.5 h-[3px] rounded" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Scheduled / Unscheduled + Week Summary - horizontal scroll on mobile */}
      <div className="relative mt-5">
        <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide md:overflow-visible md:grid md:grid-cols-2 lg:grid-cols-3 pb-2 px-1 md:gap-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="bg-[var(--card)] border border-[var(--brd)] min-w-[280px] shrink-0 snap-start md:min-w-0 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-[var(--tx)] mb-4">Upcoming</h3>
          <ul className="space-y-2 max-h-[280px] overflow-y-auto">
            {deliveriesThisWeek.map((d) => (
              <li key={d.id}>
                <UpcomingItem
                  href={getDeliveryDetailPath(d)}
                  name={d.customer_name || d.delivery_number || "—"}
                  date={d.scheduled_date}
                  time={d.time_slot || d.delivery_window}
                  badgeType="project"
                />
              </li>
            ))}
            {movesThisWeek.map((m) => (
              <li key={m.id}>
                <UpcomingItem
                  href={getMoveDetailPath(m)}
                  name={m.client_name || "—"}
                  date={m.scheduled_date}
                  time={m.scheduled_time || m.time}
                  badgeType={m.move_type === "office" ? "move-office" : "move-residential"}
                />
              </li>
            ))}
            {deliveriesThisWeek.length === 0 && movesThisWeek.length === 0 && (
              <li className="text-[11px] text-[var(--tx3)] py-2">No upcoming jobs this week</li>
            )}
          </ul>
          <Link href="/admin/deliveries" className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] hover:underline">
            View all →
          </Link>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] min-w-[280px] shrink-0 snap-start md:min-w-0 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-[var(--tx)] mb-4">Week Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSummaryModal("total")} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 transition-all text-left active:scale-[0.99]">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Jobs</div>
              <div className="text-[22px] font-bold font-heading text-[var(--tx)]">{totalWeek}</div>
              <div className="text-[9px] text-[var(--tx3)] mt-1">All B2B + B2C</div>
            </button>
            <button type="button" onClick={() => setSummaryModal("b2b")} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 transition-all text-left active:scale-[0.99]">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">B2B</div>
              <div className="text-[22px] font-bold font-heading text-[var(--gold)]">{deliveriesThisWeek.length}</div>
              <div className="text-[9px] text-[var(--tx3)] mt-1">Deliveries</div>
            </button>
            <button type="button" onClick={() => setSummaryModal("b2c")} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 transition-all text-left active:scale-[0.99]">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">B2C Moves</div>
              <div className="text-[22px] font-bold font-heading text-[var(--grn)]">{movesThisWeek.length}</div>
              <div className="text-[9px] text-[var(--tx3)] mt-1">Residential / Office</div>
            </button>
            <button type="button" onClick={() => setSummaryModal("unassigned")} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 transition-all text-left active:scale-[0.99]">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Unassigned</div>
              <div className={`text-[22px] font-bold font-heading ${unassigned > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{unassigned}</div>
              <div className="text-[9px] text-[var(--tx3)] mt-1">Need crew</div>
            </button>
          </div>
        </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none md:hidden" aria-hidden />
      </div>

      {/* Week summary modal - uses GlobalModal (Portal) */}
      {summaryModal && (
        <GlobalModal
          open={!!summaryModal}
          onClose={() => setSummaryModal(null)}
          title={
            summaryModal === "total" ? "All jobs this week" :
            summaryModal === "b2b" ? "B2B Deliveries" :
            summaryModal === "b2c" ? "B2C Moves" : "Unassigned"
          }
          maxWidth="lg"
        >
          <div className="p-5">
            {summaryModal === "total" && (
              <ul className="space-y-2">
                {deliveriesThisWeek.map((d) => (
                  <li key={d.id}>
                    <UpcomingItem href={getDeliveryDetailPath(d)} name={d.customer_name || d.delivery_number || "—"} date={d.scheduled_date} time={d.time_slot || d.delivery_window} badgeType="project" />
                  </li>
                ))}
                {movesThisWeek.map((m) => (
                  <li key={m.id}>
                    <UpcomingItem href={getMoveDetailPath(m)} name={m.client_name || "—"} date={m.scheduled_date} time={m.scheduled_time || m.time} badgeType={m.move_type === "office" ? "move-office" : "move-residential"} />
                  </li>
                ))}
                {deliveriesThisWeek.length === 0 && movesThisWeek.length === 0 && <p className="text-[11px] text-[var(--tx3)]">No jobs this week</p>}
              </ul>
            )}
            {summaryModal === "b2b" && (
              <ul className="space-y-2">
                {deliveriesThisWeek.map((d) => (
                  <li key={d.id}>
                    <UpcomingItem href={getDeliveryDetailPath(d)} name={d.customer_name || d.delivery_number || "—"} date={d.scheduled_date} time={d.time_slot || d.delivery_window} badgeType="project" />
                  </li>
                ))}
                {deliveriesThisWeek.length === 0 && <p className="text-[11px] text-[var(--tx3)]">No B2B deliveries this week</p>}
              </ul>
            )}
            {summaryModal === "b2c" && (
              <ul className="space-y-2">
                {movesThisWeek.map((m) => (
                  <li key={m.id}>
                    <UpcomingItem href={getMoveDetailPath(m)} name={m.client_name || "—"} date={m.scheduled_date} time={m.scheduled_time || m.time} badgeType={m.move_type === "office" ? "move-office" : "move-residential"} />
                  </li>
                ))}
                {movesThisWeek.length === 0 && <p className="text-[11px] text-[var(--tx3)]">No B2C moves this week</p>}
              </ul>
            )}
            {summaryModal === "unassigned" && (
              <ul className="space-y-2">
                {deliveries.filter((d) => !d.crew_id).map((d) => (
                  <li key={d.id}>
                    <UpcomingItem href={getDeliveryDetailPath(d)} name={d.customer_name || d.delivery_number || "—"} date={d.scheduled_date} time={d.time_slot || d.delivery_window} badgeType="project" />
                  </li>
                ))}
                {deliveries.filter((d) => !d.crew_id).length === 0 && <p className="text-[11px] text-[var(--tx3)]">All jobs assigned</p>}
              </ul>
            )}
          </div>
        </GlobalModal>
      )}
    </>
  );
}