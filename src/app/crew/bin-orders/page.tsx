"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";
import WineFadeRule from "@/components/crew/WineFadeRule";
import { formatAccessForDisplay } from "@/lib/format-text";
import { addCalendarDaysYmd, getTodayString } from "@/lib/business-timezone";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off scheduled",
  bins_delivered: "Delivered",
  in_use: "In use",
  pickup_scheduled: "Pickup scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

interface BinTask {
  id: string;
  order_number: string;
  client_name: string;
  /** May be empty when not on file */
  client_phone: string;
  delivery_address: string;
  pickup_address: string | null;
  delivery_access: string;
  delivery_notes: string | null;
  bundle_type: string;
  bin_count: number;
  move_date: string;
  drop_off_date: string;
  pickup_date: string;
  status: string;
  drop_off_completed_at: string | null;
  pickup_completed_at: string | null;
  taskType: "dropoff" | "pickup";
}

const BUNDLE_SHORT: Record<string, string> = {
  studio: "Studio",
  "1br": "1BR",
  "2br": "2BR",
  "3br": "3BR",
  "4br_plus": "4BR+",
  individual: "Custom",
};

const bundleLabel = (bundleType: string) => {
  const k = String(bundleType || "").trim();
  if (!k) return "Bundle";
  return BUNDLE_SHORT[k] ?? k.replace(/_/g, " ");
};

const normalizePhoneFromApi = (value: unknown): string => {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
};

const primaryAddress = (task: BinTask) => {
  if (task.taskType === "pickup") {
    const p = (task.pickup_address || "").trim();
    if (p) return p;
  }
  return task.delivery_address;
};

export default function CrewBinOrdersPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<BinTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<BinTask | null>(null);

  const [completing, setCompleting] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [binsReturned, setBinsReturned] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const today = getTodayString();
      const tomorrowStr = addCalendarDaysYmd(today, 1);

      const res = await fetch("/api/crew/bin-orders");
      if (res.status === 401) {
        router.replace("/crew/login");
        return;
      }
      const data = await res.json();

      const all: BinTask[] = [];
      for (const raw of data.orders || []) {
        const o = {
          ...raw,
          client_phone: normalizePhoneFromApi(raw.client_phone),
        };
        if (
          (o.drop_off_date === today || o.drop_off_date === tomorrowStr) &&
          !o.drop_off_completed_at &&
          o.status !== "cancelled"
        ) {
          all.push({ ...o, taskType: "dropoff" as const });
        }
        if (
          (o.pickup_date === today || o.pickup_date === tomorrowStr) &&
          o.drop_off_completed_at &&
          !o.pickup_completed_at &&
          o.status !== "cancelled"
        ) {
          all.push({ ...o, taskType: "pickup" as const });
        }
        if (o.status === "overdue" && !o.pickup_completed_at) {
          const alreadyAdded = all.some((t) => t.id === o.id && t.taskType === "pickup");
          if (!alreadyAdded) all.push({ ...o, taskType: "pickup" as const });
        }
      }

      setTasks(all);
    } catch {
      setError("Failed to load bin tasks");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openTask = (task: BinTask) => {
    setActiveTask(task);
    setCompleting(false);
    setBinsReturned(task.bin_count);
    setCrewName("");
    setDone(null);
    setError(null);
  };

  const submitCompletion = async () => {
    if (!activeTask) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload =
        activeTask.taskType === "dropoff"
          ? { id: activeTask.id, action: "complete_dropoff", crewName }
          : { id: activeTask.id, action: "complete_pickup", crewName, binsReturned };

      const res = await fetch("/api/crew/bin-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");

      const msg =
        activeTask.taskType === "dropoff"
          ? "Bins delivered. The client has been notified."
          : data.binsMissing > 0
            ? `Pickup complete. ${data.binsMissing} missing, $${data.missingCharge?.toFixed(2)} charged.`
            : "Bins collected. Thank the client when you can.";

      setDone({ orderNumber: activeTask.order_number, message: msg });
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const todayYmd = getTodayString();
  const activeTaskAccessLabel = activeTask ? formatAccessForDisplay(activeTask.delivery_access) : null;

  const pickupDiffers =
    activeTask &&
    activeTask.taskType === "pickup" &&
    (activeTask.pickup_address || "").trim() &&
    (activeTask.pickup_address || "").trim() !== (activeTask.delivery_address || "").trim();

  return (
    <PageContent>
      <section className="max-w-[600px] mx-auto pb-10">
        <header className="pb-2 mb-6 sm:mb-8">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[#5C1A33] [font-family:var(--font-body)]">
            Crew
          </p>
          <h1 className="font-hero text-[28px] sm:text-[32px] font-bold text-[#5C1A33] leading-[1.12] tracking-tight">
            Bin tasks
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[var(--tx2)] mt-3 leading-relaxed max-w-[40ch]">
            Today and tomorrow: drop-offs and pickups in your area.
          </p>
          <div className="mt-8">
            <WineFadeRule className="opacity-50" />
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <p className="text-[15px] text-[var(--tx3)] font-medium animate-pulse">Loading tasks</p>
          </div>
        )}

        {!loading && error && !tasks.length && !activeTask && (
          <div className="rounded-2xl bg-[#FAF7F2] shadow-[0_2px_28px_rgba(44,62,45,0.06)] border border-[var(--brd)]/25 px-6 py-8 text-center">
            <p className="text-[14px] text-[var(--red)] font-medium">{error}</p>
          </div>
        )}

        {!loading && tasks.length === 0 && !activeTask && !done && !error && (
          <div className="rounded-2xl bg-[#FAF7F2] shadow-[0_2px_28px_rgba(44,62,45,0.06)] border border-[var(--brd)]/25 px-6 py-12 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] leading-tight text-[var(--tx)] mb-3 [font-family:var(--font-body)]">
              No bin tasks right now
            </p>
            <p className="text-[15px] text-[var(--tx2)] leading-relaxed max-w-[34ch] mx-auto">
              Nothing scheduled for today or tomorrow. Check back later or contact dispatch if this looks wrong.
            </p>
          </div>
        )}

        {!loading && tasks.length > 0 && !activeTask && !done && (
          <div className="space-y-0">
            {tasks.map((task, index) => {
              const isToday =
                task.taskType === "dropoff"
                  ? task.drop_off_date === todayYmd
                  : task.pickup_date === todayYmd;
              const addr = primaryAddress(task);
              const accent =
                task.taskType === "dropoff" ? "border-l-[#5C1A33]" : "border-l-[#2C3E2D]";
              return (
                <div key={`${task.id}-${task.taskType}`}>
                  {index > 0 && <WineFadeRule className="my-7 sm:my-8" />}
                  <button
                    type="button"
                    onClick={() => openTask(task)}
                    className={`w-full text-left rounded-2xl border border-[var(--brd)]/25 bg-[#FAF7F2] shadow-[0_2px_28px_rgba(44,62,45,0.06)] pl-5 pr-4 py-5 sm:pl-6 sm:pr-5 sm:py-6 border-l-[5px] ${accent} transition-all hover:shadow-[0_8px_36px_rgba(44,62,45,0.12)] active:scale-[0.99]`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="font-mono text-[13px] sm:text-[14px] font-bold text-[var(--tx)] tracking-tight">
                            {task.order_number}
                          </span>
                          {task.status === "overdue" && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-red-500/10 text-red-800 [font-family:var(--font-body)]">
                              Overdue
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md bg-[#5C1A33]/10 text-[#5C1A33] [font-family:var(--font-body)] leading-none">
                            {task.taskType === "dropoff" ? "Drop-off" : "Pickup"}
                          </span>
                        </div>
                        <p className="text-[17px] sm:text-[18px] font-semibold text-[var(--tx)] leading-snug">
                          {task.client_name}
                        </p>
                        <p className="text-[15px] sm:text-[16px] text-[var(--tx2)] leading-relaxed">
                          {addr}
                        </p>
                      </div>
                      <div className="text-left sm:text-right shrink-0 sm:min-w-[7.5rem] pt-0.5 border-t border-[var(--brd)]/25 sm:border-0 sm:pt-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#243524] [font-family:var(--font-body)]">
                          {isToday ? "Today" : "Tomorrow"}
                        </p>
                        <p className="text-[13px] sm:text-[14px] text-[var(--tx)] font-medium mt-1.5 leading-snug">
                          {bundleLabel(task.bundle_type)} · {task.bin_count} bins
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-[var(--brd)]/20 flex justify-end">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#243524] [font-family:var(--font-body)] underline underline-offset-2 decoration-[#243524]/35">
                        Open task
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTask && !done && (
          <div className="mt-2 space-y-6">
            <button
              type="button"
              onClick={() => setActiveTask(null)}
              className="text-[var(--tx2)] hover:text-[#243524] transition-colors text-[14px] font-semibold underline underline-offset-2 decoration-[var(--tx2)]/40"
            >
              Back to list
            </button>

            <div className="rounded-2xl border border-[var(--brd)]/25 bg-[#FAF7F2] shadow-[0_2px_28px_rgba(44,62,45,0.06)] p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--brd)]/30">
                <div>
                  <span className="font-mono text-[14px] font-bold text-[var(--tx)]">{activeTask.order_number}</span>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md bg-[#5C1A33]/10 text-[#5C1A33] [font-family:var(--font-body)] leading-none align-middle inline-block">
                    {activeTask.taskType === "dropoff" ? "Drop-off" : "Pickup"}
                  </span>
                </div>
                <span className="text-[12px] font-semibold text-[var(--tx3)]">
                  {STATUS_LABELS[activeTask.status] || activeTask.status}
                </span>
              </div>

              <div className="space-y-5 text-[15px]">
                <DetailBlock kicker="Bins">
                  {bundleLabel(activeTask.bundle_type)} bundle · {activeTask.bin_count} bins
                </DetailBlock>
                {pickupDiffers && activeTask ? (
                  <>
                    <DetailBlock kicker="Pickup address">
                      {(activeTask.pickup_address || "").trim()}
                    </DetailBlock>
                    <DetailBlock kicker="Originally delivered to">
                      {activeTask.delivery_address}
                    </DetailBlock>
                  </>
                ) : (
                  <DetailBlock kicker={activeTask.taskType === "pickup" ? "Pickup address" : "Address"}>
                    {primaryAddress(activeTask)}
                  </DetailBlock>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-1.5 [font-family:var(--font-body)]">
                    Contact
                  </p>
                  <p className="font-semibold text-[16px] text-[var(--tx)]">{activeTask.client_name}</p>
                  {activeTask.client_phone.trim() ? (
                    <a
                      href={`tel:${activeTask.client_phone.replace(/\s/g, "")}`}
                      className="text-[16px] font-semibold text-[#5C1A33] hover:underline mt-1 inline-block"
                    >
                      {activeTask.client_phone}
                    </a>
                  ) : (
                    <p className="text-[15px] text-[var(--tx3)] font-medium mt-1">No phone on file</p>
                  )}
                </div>
                {activeTaskAccessLabel && (
                  <DetailBlock kicker="Access">{activeTaskAccessLabel}</DetailBlock>
                )}
                {activeTask.delivery_notes && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/90 mb-1.5 [font-family:var(--font-body)]">
                      Notes
                    </p>
                    <p className="text-[15px] text-[var(--tx2)] leading-relaxed">{activeTask.delivery_notes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white/80 border border-[var(--brd)]/30 px-4 py-4 text-[14px] sm:text-[15px] text-[var(--tx2)] space-y-2">
                <p>
                  <span className="text-[var(--tx3)] font-medium">Drop-off</span>{" "}
                  <span className="font-semibold text-[var(--tx)]">{fmtDate(activeTask.drop_off_date)}</span>
                </p>
                <p>
                  <span className="text-[var(--tx3)] font-medium">Move</span>{" "}
                  <span className="font-semibold text-[var(--tx)]">{fmtDate(activeTask.move_date)}</span>
                </p>
                <p>
                  <span className="text-[var(--tx3)] font-medium">Pickup</span>{" "}
                  <span className="font-semibold text-[var(--tx)]">{fmtDate(activeTask.pickup_date)}</span>
                </p>
              </div>
            </div>

            {!completing ? (
              <button
                type="button"
                onClick={() => setCompleting(true)}
                className="crew-premium-cta w-full min-h-[56px] inline-flex items-center justify-center py-3.5 font-bold text-[11px] uppercase tracking-[0.12em] text-white transition-all active:scale-[0.98] [font-family:var(--font-body)] leading-none"
              >
                {activeTask.taskType === "dropoff" ? "Mark bins delivered" : "Mark pickup complete"}
              </button>
            ) : (
              <div className="rounded-2xl border border-[var(--brd)]/25 bg-[#FAF7F2] p-5 sm:p-7 space-y-6 shadow-[0_2px_28px_rgba(44,62,45,0.06)]">
                <h3 className="font-hero text-[22px] font-bold text-[#5C1A33]">
                  {activeTask.taskType === "dropoff" ? "Confirm delivery" : "Confirm pickup"}
                </h3>

                {activeTask.taskType === "pickup" && (
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)] mb-2 [font-family:var(--font-body)]">
                      Bins collected (delivered: {activeTask.bin_count})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={activeTask.bin_count}
                      value={binsReturned}
                      onChange={(e) =>
                        setBinsReturned(
                          Math.min(activeTask.bin_count, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        )
                      }
                      className="w-full rounded-xl border border-[var(--brd)]/60 bg-white px-3 py-3.5 text-center text-[24px] font-bold text-[var(--tx)] focus:outline-none focus:ring-2 focus:ring-[#5C1A33]/25"
                    />
                    {binsReturned < activeTask.bin_count && (
                      <p className="text-[13px] text-red-700 mt-2 leading-relaxed font-medium">
                        {activeTask.bin_count - binsReturned} bins missing. A ${((activeTask.bin_count - binsReturned) * 20).toFixed(0)} charge will apply.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)] mb-2 [font-family:var(--font-body)]">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                    placeholder="e.g. Marcus"
                    className="w-full rounded-xl border border-[var(--brd)]/60 bg-white px-3 py-3.5 text-[16px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:outline-none focus:ring-2 focus:ring-[#5C1A33]/25"
                  />
                </div>

                <div className="rounded-xl border border-[#5C1A33]/15 bg-[#FFFBF7] px-4 py-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5C1A33]/90 [font-family:var(--font-body)]">
                    Photos
                  </p>
                  <p className="text-[13px] sm:text-[14px] text-[var(--tx2)] leading-relaxed">
                    If dispatch asked for photos, take them on your phone and send them in the crew WhatsApp thread so ops can file them with this order.
                  </p>
                </div>

                {error && (
                  <p className="text-[14px] text-red-800 bg-red-500/10 rounded-xl px-3 py-2.5 border border-red-500/20 font-medium">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setCompleting(false)}
                    className="flex-1 py-3.5 text-[14px] font-semibold text-[var(--tx2)] hover:text-[#243524] transition-colors rounded-xl border border-[var(--brd)]/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitCompletion}
                    disabled={submitting}
                    className="crew-premium-cta flex-[1.2] min-h-[52px] py-3.5 font-bold text-[11px] uppercase tracking-[0.12em] text-white transition-all disabled:opacity-50 [font-family:var(--font-body)] leading-none"
                  >
                    {submitting ? "Submitting" : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="mt-10 text-center space-y-6 px-2">
            <div className="mx-auto max-w-sm rounded-2xl border-2 border-[#2C3E2D]/20 bg-[#FAF7F2] px-6 py-8 shadow-[0_2px_28px_rgba(44,62,45,0.06)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#243524] [font-family:var(--font-body)] mb-3">
                Recorded
              </p>
              <h2 className="font-hero text-[24px] font-bold text-[#5C1A33]">{done.orderNumber}</h2>
              <p className="text-[#243524] font-medium text-[16px] mt-3 leading-relaxed">{done.message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTask(null);
                setDone(null);
              }}
              className="crew-premium-cta px-10 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white [font-family:var(--font-body)] leading-none"
            >
              Back to tasks
            </button>
          </div>
        )}
      </section>
    </PageContent>
  );
}

function DetailBlock({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-1.5 [font-family:var(--font-body)]">
        {kicker}
      </p>
      <p className="text-[15px] sm:text-[16px] text-[var(--tx2)] leading-relaxed">{children}</p>
    </div>
  );
}
