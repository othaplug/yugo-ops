"use client";

import { useState, useMemo } from "react";

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  status: string;
  scheduled_date: string | null;
  time_slot: string | null;
}

const STATUS_DOT: Record<string, string> = {
  scheduled: "#3B82F6",
  confirmed: "#2D9F5A",
  dispatched: "#D48A29",
  "in-transit": "#D48A29",
  in_transit: "#D48A29",
  delivered: "#2D9F5A",
  completed: "#2D9F5A",
  pending: "#C9A962",
  cancelled: "#D14343",
};

export default function PartnerCalendarTab({ deliveries }: { deliveries: Delivery[] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;

  const deliveriesByDate = useMemo(() => {
    const map: Record<string, Delivery[]> = {};
    deliveries.forEach((d) => {
      if (!d.scheduled_date) return;
      const key = d.scheduled_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deliveries]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < adjustedFirst; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-bold text-[#1A1A1A] font-serif">{monthLabel}</h3>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[#E8E4DF] border border-[#E8E4DF] rounded-xl overflow-hidden">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-[#F5F3F0] py-2 text-center text-[10px] font-semibold tracking-wider uppercase text-[#888]">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-white min-h-[80px]" />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayDeliveries = deliveriesByDate[dateKey] || [];
          const isToday = dateKey === todayKey;

          return (
            <div key={dateKey} className={`bg-white min-h-[80px] p-1.5 ${isToday ? "ring-2 ring-inset ring-[#C9A962]/50" : ""}`}>
              <div className={`text-[12px] font-medium ${isToday ? "text-[#C9A962] font-bold" : "text-[#1A1A1A]"}`}>{day}</div>
              <div className="mt-1 space-y-0.5">
                {dayDeliveries.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] truncate bg-[#F5F3F0]">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[(d.status || "").toLowerCase()] || "#C9A962" }} />
                    <span className="truncate text-[#1A1A1A]">{d.customer_name || d.delivery_number}</span>
                  </div>
                ))}
                {dayDeliveries.length > 3 && (
                  <div className="text-[8px] text-[#888] pl-1">+{dayDeliveries.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
