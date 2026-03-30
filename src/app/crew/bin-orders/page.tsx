"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Recycle,
  Truck,
  CheckCircle,
  MapPin,
  Phone,
  ArrowLeft,
  Camera,
  Warning,
} from "@phosphor-icons/react";
import { formatAccessForDisplay } from "@/lib/format-text";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off Scheduled",
  bins_delivered: "Delivered",
  in_use: "In Use",
  pickup_scheduled: "Pickup Scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

interface BinTask {
  id: string;
  order_number: string;
  client_name: string;
  client_phone: string;
  delivery_address: string;
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
  studio: "Studio", "1br": "1BR", "2br": "2BR",
  "3br": "3BR", "4br_plus": "4BR+", individual: "Custom",
};

export default function CrewBinOrdersPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<BinTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<BinTask | null>(null);

  // Completion flow state
  const [completing, setCompleting] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [binsReturned, setBinsReturned] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const res = await fetch("/api/crew/bin-orders");
      if (res.status === 401) { router.replace("/crew/login"); return; }
      const data = await res.json();

      const all: BinTask[] = [];
      for (const o of data.orders || []) {
        // Drop-off tasks: today or tomorrow, not yet delivered
        if ((o.drop_off_date === today || o.drop_off_date === tomorrowStr) && !o.drop_off_completed_at && o.status !== "cancelled") {
          all.push({ ...o, taskType: "dropoff" as const });
        }
        // Pickup tasks: today or tomorrow, already delivered, not yet picked up
        if ((o.pickup_date === today || o.pickup_date === tomorrowStr) && o.drop_off_completed_at && !o.pickup_completed_at && o.status !== "cancelled") {
          all.push({ ...o, taskType: "pickup" as const });
        }
        // Overdue pickups
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

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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
          ? "Bins delivered! Client has been notified."
          : data.binsMissing > 0
          ? `Pickup complete. ${data.binsMissing} missing, $${data.missingCharge?.toFixed(2)} charged.`
          : "Bins collected! Client thanked.";

      setDone({ orderNumber: activeTask.order_number, message: msg });
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

  const today = new Date().toISOString().split("T")[0];
  const activeTaskAccessLabel = activeTask ? formatAccessForDisplay(activeTask.delivery_access) : null;

  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-[18px] font-bold">Bin Tasks</h1>
        <p className="text-[12px] text-gray-400">Today&apos;s drop-offs and pickups</p>
      </div>

      <div className="px-4 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="w-5 h-5 border-2 border-[#C9A962]/30 border-t-[#C9A962] rounded-full animate-spin" />
            <span className="text-gray-400 text-[13px]">Loading tasks…</span>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-gray-400 font-medium">No bin tasks today or tomorrow</p>
          </div>
        )}

        {!loading && tasks.length > 0 && !activeTask && (
          <div className="space-y-3 mt-4">
            {tasks.map((task) => {
              const isToday = task.taskType === "dropoff" ? task.drop_off_date === today : task.pickup_date === today;
              return (
                <button
                  key={`${task.id}-${task.taskType}`}
                  onClick={() => openTask(task)}
                  className="w-full text-left bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4 hover:border-[#C9A962]/40 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${task.taskType === "dropoff" ? "bg-[#7C9FD4]/15" : "bg-[#22c55e]/15"}`}>
                        {task.taskType === "dropoff"
                          ? <Truck size={18} color="#7C9FD4" />
                          : <CheckCircle size={18} color="#22c55e" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[14px]">{task.order_number}</span>
                          {task.status === "overdue" && <Warning size={13} color="#ef4444" />}
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${task.taskType === "dropoff" ? "bg-[#7C9FD4]/15 text-[#7C9FD4]" : "bg-[#22c55e]/15 text-[#22c55e]"}`}>
                            {task.taskType === "dropoff" ? <><Recycle size={10} className="inline" /> Drop-off</> : <><Truck size={10} className="inline" /> Pickup</>}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-300 mt-0.5">{task.client_name}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} />
                          {task.delivery_address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold text-[#C9A962]">{isToday ? "Today" : "Tomorrow"}</p>
                      <p className="text-[11px] text-gray-500">{BUNDLE_SHORT[task.bundle_type]} · {task.bin_count} bins</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Task detail view */}
        {activeTask && !done && (
          <div className="mt-4 space-y-4">
            <button onClick={() => setActiveTask(null)} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-[13px]">
              <ArrowLeft size={14} /> Back to list
            </button>

            <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[16px]">{activeTask.order_number}</span>
                  <span className={`ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${activeTask.taskType === "dropoff" ? "bg-[#7C9FD4]/15 text-[#7C9FD4]" : "bg-[#22c55e]/15 text-[#22c55e]"}`}>
                    {activeTask.taskType === "dropoff"
                    ? <><Recycle size={11} className="inline mr-0.5" /> Drop-off</>
                    : <><Truck size={11} className="inline mr-0.5" /> Pickup</>}
                  </span>
                </div>
                <span className="text-[12px] text-gray-400">
                  {STATUS_LABELS[activeTask.status] || activeTask.status}
                </span>
              </div>

              <div className="space-y-2 text-[13px]">
                <DetailRow icon={<Recycle size={13} />} label={`${BUNDLE_SHORT[activeTask.bundle_type]} bundle, ${activeTask.bin_count} bins`} />
                <DetailRow icon={<MapPin size={13} />} label={activeTask.delivery_address} />
                <DetailRow icon={<Phone size={13} />} label={activeTask.client_name} sub={activeTask.client_phone} isPhone />
                {activeTaskAccessLabel && (
                  <DetailRow icon={<Truck size={13} />} label={`Access: ${activeTaskAccessLabel}`} />
                )}
                {activeTask.delivery_notes && (
                  <DetailRow icon={<Warning size={13} />} label={activeTask.delivery_notes} />
                )}
              </div>

              <div className="bg-[#0F1117] rounded-lg p-3 text-[12px] text-gray-400 space-y-1">
                <p>Drop-off date: <span className="text-white">{fmtDate(activeTask.drop_off_date)}</span></p>
                <p>Move date: <span className="text-white">{fmtDate(activeTask.move_date)}</span></p>
                <p>Pickup date: <span className="text-white">{fmtDate(activeTask.pickup_date)}</span></p>
              </div>
            </div>

            {/* Completion form */}
            {!completing ? (
              <button
                onClick={() => setCompleting(true)}
                className={`w-full py-2.5 font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${activeTask.taskType === "dropoff" ? "bg-[#7C9FD4] text-white" : "bg-[#22c55e] text-white"}`}
              >
                {activeTask.taskType === "dropoff" ? <><Truck size={18} /> Mark Bins Delivered</> : <><CheckCircle size={18} /> Mark Pickup Complete</>}
              </button>
            ) : (
              <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-[15px]">
                  {activeTask.taskType === "dropoff" ? "Confirm Delivery" : "Confirm Pickup"}
                </h3>

                {activeTask.taskType === "pickup" && (
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-400 mb-1.5">
                      Bins collected (delivered: {activeTask.bin_count})
                    </label>
                    <input
                      type="number" min={0} max={activeTask.bin_count}
                      value={binsReturned}
                      onChange={(e) => setBinsReturned(Math.min(activeTask.bin_count, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full bg-[#0F1117] border border-[#3a3d4a] rounded-lg px-3 py-3 text-white text-center text-[20px] font-bold focus:outline-none focus:border-[#C9A962]"
                    />
                    {binsReturned < activeTask.bin_count && (
                      <p className="text-[12px] text-red-400 mt-1.5 flex items-center gap-1">
                        <Warning size={12} />
                        {activeTask.bin_count - binsReturned} bins missing, $
                        {((activeTask.bin_count - binsReturned) * 20).toFixed(0)} charge will be applied
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-gray-400 mb-1.5">Your name</label>
                  <input
                    type="text" value={crewName} onChange={(e) => setCrewName(e.target.value)}
                    placeholder="e.g. Marcus"
                    className="w-full bg-[#0F1117] border border-[#3a3d4a] rounded-lg px-3 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A962]"
                  />
                </div>

                <div className="bg-[#0F1117] rounded-lg p-3 text-[12px] text-gray-400">
                  <Camera size={13} className="inline mr-1" />
                  Photo upload: use your phone camera and share via WhatsApp to the Yugo crew group.
                </div>

                {error && (
                  <p className="text-[13px] text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setCompleting(false)}
                    className="flex-1 py-2 border border-[#3a3d4a] text-[14px] text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCompletion}
                    disabled={submitting}
                    className={`flex-1 py-2 font-bold text-[14px] text-white transition-all disabled:opacity-50 ${activeTask.taskType === "dropoff" ? "bg-[#7C9FD4]" : "bg-[#22c55e]"}`}
                  >
                    {submitting ? "Submitting…" : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Done state */}
        {done && (
          <div className="mt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={36} color="#22c55e" weight="fill" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold">{done.orderNumber}</h2>
              <p className="text-green-400 font-medium text-[14px] mt-1">{done.message}</p>
            </div>
            <button
              onClick={() => { setActiveTask(null); setDone(null); }}
              className="px-4 py-2 bg-[#1a1d27] border border-[#2a2d3a] text-[14px] font-medium hover:border-[#C9A962]/40 transition-colors"
            >
              Back to tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon, label, sub, isPhone,
}: { icon: React.ReactNode; label: string; sub?: string; isPhone?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 text-gray-300">
      <span className="text-gray-500 mt-0.5 shrink-0">{icon}</span>
      <div>
        {isPhone ? (
          <a href={`tel:${sub}`} className="text-[#C9A962] hover:underline">
            {label}, {sub}
          </a>
        ) : (
          <>
            <span>{label}</span>
            {sub && <p className="text-gray-500 text-[11px]">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}
