"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";

interface CalendarViewProps {
  deliveries: any[];
  moves: any[];
  crews: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  retail: "#C9A962",
  designer: "#C9A962",
  hospitality: "#D48A29",
  gallery: "#4A7CE5",
  b2c: "#2D9F5A",
};

export default function CalendarView({ deliveries, moves, crews }: CalendarViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"delivery" | "move" | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate week days
  const baseDate = new Date("2026-02-09");
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

  const unassigned = deliveries.filter((d) => d.status === "pending").length;
  const totalWeek = days.reduce((sum, day) => {
    const { dels, mvs } = getEventsForDay(day);
    return sum + dels.length + mvs.length;
  }, 0);

  return (
    <>
      {/* Week Header - responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
        <div className="flex gap-1.5">
          <Link href="/admin/deliveries/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all">
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
                today ? "border-[var(--gold)] shadow-[0_0_0_1px_rgba(201,169,98,.2)] bg-[var(--gdim)]/30" : "border-[var(--brd)]"
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
                      router.push(`/admin/deliveries/${d.id}`);
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
                    router.push(`/admin/moves/${m.id}`);
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

      {/* Crew + Week Summary - stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <h3 className="text-[13px] font-bold mb-3">Crew Assignments</h3>
          {crews.map((c) => {
            const jobCount = deliveries.filter((d) =>
              d.crew_id === c.id
            ).length;
            return (
              <div key={c.id} className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-[var(--gold)] bg-[var(--gdim)]">
                  {c.name?.replace("Team ", "")}
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold">{c.name} • {(c.members || []).join(", ")}</div>
                  <div className="text-[9px] text-[var(--tx3)]">{jobCount} jobs this week</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-[var(--grn)]" />
              </div>
            );
          })}
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <h3 className="text-[13px] font-bold mb-3">Week Summary</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Total Jobs", totalWeek, ""],
              ["B2B", deliveries.length, ""],
              ["B2C Moves", moves.length, ""],
              ["Unassigned", unassigned, "text-[var(--org)]"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--brd)]">
                <div className="text-[8px] text-[var(--tx3)] uppercase font-bold">{label}</div>
                <div className={`text-xl font-bold font-heading ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}