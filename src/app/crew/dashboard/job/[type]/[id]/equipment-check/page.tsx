"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft as PhCaretLeft, WarningCircle } from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";
import { useCrewImmersiveNav } from "@/app/crew/components/CrewImmersiveNavContext";
import {
  EQUIPMENT_TRACKING_UNAVAILABLE_CODE,
  EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE,
  isEquipmentRelationUnavailable,
} from "@/lib/supabase-equipment-errors";

const FOREST_PRIMARY = "#2C3E2D";
const INK = "#1A1A1A";
const MUTED = "#6B7A6E";
const BG = "#FAF8F4";
const BORDER = "#E8E4DC";
const NOTE_FILL = "#F0EDE8";

function ChevronLeft({ size = 16 }: { size?: number }) {
  return <PhCaretLeft size={size} />;
}

export default function CrewEquipmentCheckPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const router = useRouter();
  const { setImmersiveNav } = useCrewImmersiveNav();

  const [jobReady, setJobReady] = useState<boolean | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [eqLines, setEqLines] = useState<
    {
      equipment_id: string;
      name: string;
      category: string;
      assigned_quantity: number;
      current_quantity: number;
      is_consumable: boolean;
    }[]
  >([]);
  const [eqLoading, setEqLoading] = useState(true);
  const [eqMsg, setEqMsg] = useState<string | null>(null);
  const [eqCounts, setEqCounts] = useState<Record<string, number>>({});
  const [eqBatchReason, setEqBatchReason] = useState<string>("");
  const [eqLeftRetrieve, setEqLeftRetrieve] = useState(false);
  const [eqEquipSubmitting, setEqEquipSubmitting] = useState(false);
  const [eqSkipOpen, setEqSkipOpen] = useState(false);
  const [eqSkipChoice, setEqSkipChoice] = useState<
    "" | "labour_only" | "emergency_later"
  >("");
  const [eqSkipNote, setEqSkipNote] = useState("");
  const [error, setError] = useState("");
  const [equipmentUnavailable, setEquipmentUnavailable] = useState(false);

  useEffect(() => {
    setImmersiveNav(true);
    return () => setImmersiveNav(false);
  }, [setImmersiveNav]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionRes, signoffRes] = await Promise.all([
          fetch(`/api/crew/session/${jobType}/${id}`),
          fetch(
            `/api/crew/signoff/${encodeURIComponent(id)}?jobType=${encodeURIComponent(jobType)}`,
          ),
        ]);
        const sessionData = sessionRes.ok ? await sessionRes.json() : {};
        const signoffData = signoffRes.ok ? await signoffRes.json() : {};
        if (cancelled) return;
        const completed = sessionData?.session?.status === "completed";
        setJobReady(completed);
        if (signoffData?.equipmentCheckDone) setAlreadyDone(true);
      } catch {
        if (!cancelled) setJobReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, jobType]);

  useEffect(() => {
    if (jobReady !== true || alreadyDone) {
      setEqLoading(false);
      return;
    }
    let cancelled = false;
    setEqLoading(true);
    setEqMsg(null);
    setEquipmentUnavailable(false);
    setEqSkipOpen(false);
    setError("");
    fetch(
      `/api/crew/equipment-check/${encodeURIComponent(id)}?jobType=${encodeURIComponent(jobType)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.code === EQUIPMENT_TRACKING_UNAVAILABLE_CODE) {
          setEquipmentUnavailable(true);
          setEqMsg(d.message || EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE);
          setEqLines([]);
          return;
        }
        if (d.error) {
          const raw = String(d.error);
          if (isEquipmentRelationUnavailable(raw)) {
            setEquipmentUnavailable(true);
            setEqMsg(EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE);
          } else {
            setEqMsg(raw);
          }
          setEqLines([]);
          return;
        }
        if (d.message) setEqMsg(d.message);
        const lines = Array.isArray(d.lines) ? d.lines : [];
        setEqLines(lines);
        const init: Record<string, number> = {};
        for (const L of lines) init[L.equipment_id] = L.current_quantity;
        setEqCounts(init);
      })
      .catch(() => {
        if (!cancelled) setEqMsg("Could not load equipment list.");
      })
      .finally(() => {
        if (!cancelled) setEqLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, jobType, jobReady, alreadyDone]);

  const submitEquipmentSkip = async () => {
    if (!eqSkipChoice) return;
    setEqEquipSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/crew/equipment-check/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType,
            skipReason: eqSkipChoice,
            skipNotes: eqSkipNote.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw =
          typeof data.error === "string" ? data.error : "Could not save skip";
        if (
          data.code === EQUIPMENT_TRACKING_UNAVAILABLE_CODE ||
          isEquipmentRelationUnavailable(raw)
        ) {
          setEquipmentUnavailable(true);
          setEqSkipOpen(false);
          setEqMsg(EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE);
          setError("");
        } else {
          setError(raw);
        }
        setEqEquipSubmitting(false);
        return;
      }
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setEqEquipSubmitting(false);
  };

  const submitEquipmentCheck = async () => {
    const lines = eqLines.map((L) => ({
      equipment_id: L.equipment_id,
      actual_quantity: eqCounts[L.equipment_id] ?? L.current_quantity,
    }));
    let needsBatch = false;
    for (const L of eqLines) {
      const actual = eqCounts[L.equipment_id] ?? L.current_quantity;
      const short = L.current_quantity - actual;
      if (short <= 0) continue;
      if (!L.is_consumable) needsBatch = true;
      else if (actual <= 0 && L.current_quantity > 0) needsBatch = true;
    }
    if (needsBatch && !eqBatchReason) {
      setError("Select what happened to missing items.");
      return;
    }
    setError("");
    setEqEquipSubmitting(true);
    try {
      const res = await fetch(
        `/api/crew/equipment-check/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType,
            lines,
            shortageBatchReason: needsBatch ? eqBatchReason : undefined,
            leftAtClientWillRetrieve:
              eqBatchReason === "left_at_client" ? eqLeftRetrieve : undefined,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw =
          typeof data.error === "string" ? data.error : "Submit failed";
        if (
          data.code === EQUIPMENT_TRACKING_UNAVAILABLE_CODE ||
          isEquipmentRelationUnavailable(raw)
        ) {
          setEquipmentUnavailable(true);
          setEqMsg(EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE);
          setError("");
        } else {
          setError(raw);
        }
        setEqEquipSubmitting(false);
        return;
      }
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setEqEquipSubmitting(false);
  };

  const backHref = `/crew/dashboard/job/${jobType}/${id}`;

  if (jobReady === null) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: BG }}
      >
        <p className="text-[13px]" style={{ color: MUTED }}>
          Loading…
        </p>
      </main>
    );
  }

  if (!jobReady) {
    return (
      <main
        className="min-h-screen"
        style={{ background: BG, fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="max-w-[420px] mx-auto px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between mb-6">
            <Link
              href={backHref}
              className="flex items-center gap-1 text-[13px] font-medium py-1.5 pr-3 -ml-1 rounded-lg transition-colors hover:opacity-70"
              style={{ color: MUTED }}
            >
              <ChevronLeft size={15} /> Back
            </Link>
            <YugoLogo size={22} variant="wine" onLightBackground />
            <div className="w-14" />
          </div>
          <h1
            className="font-hero text-[26px] font-semibold leading-tight mb-2"
            style={{ color: INK }}
          >
            Equipment check
          </h1>
          <p
            className="text-[13px] leading-relaxed mb-6"
            style={{ color: MUTED }}
          >
            Complete this job (including client sign-off) first. Then count
            what&apos;s on the truck before you head to the next stop or end
            your day.
          </p>
          <Link
            href={backHref}
            className="inline-flex w-full justify-center py-2.5 font-semibold rounded-xl transition-opacity hover:opacity-90"
            style={{ backgroundColor: FOREST_PRIMARY, color: "#1A1A1A" }}
          >
            Back to job
          </Link>
        </div>
      </main>
    );
  }

  if (alreadyDone) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: BG }}
      >
        <div className="text-center max-w-sm">
          <h1
            className="font-hero text-[24px] font-semibold mb-2"
            style={{ color: INK }}
          >
            Equipment check done
          </h1>
          <p className="text-[13px] mb-6" style={{ color: MUTED }}>
            This job already has a submitted or skipped equipment check.
          </p>
          <Link
            href={backHref}
            className="text-[13px] font-medium underline underline-offset-2"
            style={{ color: MUTED }}
          >
            Back to job
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: BG, fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="max-w-[420px] mx-auto px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={backHref}
            className="flex items-center gap-1 text-[13px] font-medium py-1.5 pr-3 -ml-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: MUTED }}
          >
            <ChevronLeft size={15} /> Back
          </Link>
          <YugoLogo size={22} variant="wine" onLightBackground />
          <div className="w-14" />
        </div>

        <div className="mb-6">
          <p
            className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5"
            style={{ color: `${FOREST_PRIMARY}AA` }}
          >
            After sign-off
          </p>
          <h1
            className="font-hero text-[26px] font-semibold leading-tight"
            style={{ color: INK }}
          >
            Truck equipment check
          </h1>
          <p className="text-[12px] mt-1.5" style={{ color: MUTED }}>
            Count what&apos;s on the truck before the next job or your
            end-of-day report. Dispatch is notified if anything is missing.
          </p>
        </div>

        {eqMsg && (
          <div
            className="mb-4 p-3 rounded-xl flex gap-2 items-start"
            style={{
              backgroundColor: equipmentUnavailable
                ? "#FEF2F2"
                : `${FOREST_PRIMARY}12`,
              border: `1px solid ${equipmentUnavailable ? "#FECACA" : `${FOREST_PRIMARY}35`}`,
            }}
          >
            <WarningCircle
              size={18}
              className="shrink-0 mt-0.5"
              color={equipmentUnavailable ? "#B91C1C" : FOREST_PRIMARY}
              aria-hidden
            />
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: equipmentUnavailable ? "#991B1B" : INK }}
            >
              {eqMsg}
            </p>
          </div>
        )}

        {eqLoading ? (
          <p className="text-[13px] text-center py-8" style={{ color: MUTED }}>
            Loading equipment…
          </p>
        ) : equipmentUnavailable ? null : eqLines.length === 0 ? (
          <div className="text-center py-6 px-2">
            <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
              No equipment list for this truck yet. If your truck should have
              gear assigned, ask dispatch to set up truck equipment in the admin
              dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            {["protection", "tools", "moving", "supplies", "tech"].map(
              (cat) => {
                const inCat = eqLines.filter((l) => l.category === cat);
                if (!inCat.length) return null;
                return (
                  <div
                    key={cat}
                    className="rounded-2xl border bg-white overflow-hidden"
                    style={{ borderColor: BORDER }}
                  >
                    <div
                      className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest"
                      style={{ backgroundColor: NOTE_FILL, color: MUTED }}
                    >
                      {cat}
                    </div>
                    <div className="divide-y" style={{ borderColor: BORDER }}>
                      {inCat.map((L) => {
                        const actual =
                          eqCounts[L.equipment_id] ?? L.current_quantity;
                        const short = L.current_quantity - actual;
                        const warn =
                          short > 0 && (!L.is_consumable || actual <= 0);
                        return (
                          <div
                            key={L.equipment_id}
                            className="px-3 py-2.5 flex items-center justify-between gap-2"
                          >
                            <span
                              className="text-[12px] font-medium flex-1 min-w-0"
                              style={{ color: INK }}
                            >
                              {L.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                className="admin-premium-input admin-premium-input--compact w-14 text-center tabular-nums text-[12px]"
                                style={{
                                  borderBottomColor: warn ? "#fca5a5" : BORDER,
                                  color: INK,
                                }}
                                value={actual}
                                onChange={(e) => {
                                  const v = Math.max(
                                    0,
                                    parseInt(e.target.value, 10) || 0,
                                  );
                                  setEqCounts((prev) => ({
                                    ...prev,
                                    [L.equipment_id]: v,
                                  }));
                                }}
                                aria-label={`Actual count for ${L.name}`}
                              />
                              <span
                                className="text-[10px] tabular-nums whitespace-nowrap"
                                style={{ color: MUTED }}
                              >
                                of {L.current_quantity}
                              </span>
                              {warn ? (
                                <WarningCircle
                                  size={16}
                                  className="text-amber-600 shrink-0"
                                  aria-label="Shortage"
                                />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}

        {eqLines.length > 0 &&
          (() => {
            let needsBatch = false;
            for (const L of eqLines) {
              const actual = eqCounts[L.equipment_id] ?? L.current_quantity;
              const short = L.current_quantity - actual;
              if (short <= 0) continue;
              if (!L.is_consumable || actual <= 0) needsBatch = true;
            }
            return needsBatch ? (
              <div className="mb-4 space-y-3">
                <p className="text-[11px] font-semibold" style={{ color: INK }}>
                  What happened to missing items?
                </p>
                {(
                  [
                    {
                      v: "left_at_client",
                      label: "Left at client (retrieve later)",
                    },
                    { v: "damaged", label: "Damaged during job" },
                    { v: "lost", label: "Lost / cannot locate" },
                    { v: "consumed", label: "Used (consumables)" },
                  ] as const
                ).map((o) => (
                  <label
                    key={o.v}
                    className="flex items-center gap-2 text-[12px] cursor-pointer"
                    style={{ color: INK }}
                  >
                    <input
                      type="radio"
                      name="eq-batch"
                      checked={eqBatchReason === o.v}
                      onChange={() => setEqBatchReason(o.v)}
                      className="accent-[#2C3E2D]"
                    />
                    <span style={{ color: INK }}>{o.label}</span>
                  </label>
                ))}
                {eqBatchReason === "left_at_client" && (
                  <div
                    className="mt-2 rounded-xl border p-3 space-y-2"
                    style={{ borderColor: BORDER, backgroundColor: NOTE_FILL }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{ color: INK }}
                    >
                      Go back now to retrieve?
                    </p>
                    <label
                      className="flex items-center gap-2 text-[11px] cursor-pointer"
                      style={{ color: INK }}
                    >
                      <input
                        type="checkbox"
                        checked={eqLeftRetrieve}
                        onChange={(e) => setEqLeftRetrieve(e.target.checked)}
                        className="accent-[#2C3E2D]"
                      />
                      <span style={{ color: INK }}>
                        Yes — returning to the client now
                      </span>
                    </label>
                    <p className="text-[10px]" style={{ color: MUTED }}>
                      If unchecked, dispatch is notified to coordinate pickup
                      with the client.
                    </p>
                  </div>
                )}
              </div>
            ) : null;
          })()}

        {error ? (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-[11px] text-red-700 font-semibold">{error}</p>
          </div>
        ) : null}

        {!equipmentUnavailable ? (
          <>
            <button
              type="button"
              onClick={submitEquipmentCheck}
              disabled={eqEquipSubmitting || eqLines.length === 0}
              className="w-full py-2 font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 mb-2"
              style={{
                backgroundColor: FOREST_PRIMARY,
                color: "#1A1A1A",
                fontSize: 16,
              }}
            >
              {eqEquipSubmitting ? "Saving…" : "Submit equipment check"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEqSkipOpen(true);
                setError("");
              }}
              className="w-full py-2 text-[11px] font-semibold border rounded-xl transition-colors"
              style={{ borderColor: BORDER, color: INK }}
            >
              Skip equipment check (reason required)
            </button>
          </>
        ) : null}

        {eqSkipOpen && !equipmentUnavailable ? (
          <div
            className="mt-4 p-4 rounded-2xl border space-y-3"
            style={{ borderColor: BORDER, backgroundColor: NOTE_FILL }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: INK }}
            >
              Skip reason
            </p>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="radio"
                name="eqskip"
                checked={eqSkipChoice === "labour_only"}
                onChange={() => setEqSkipChoice("labour_only")}
                className="accent-[#2C3E2D]"
              />
              <span style={{ color: INK }}>
                No equipment used (labour-only job)
              </span>
            </label>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="radio"
                name="eqskip"
                checked={eqSkipChoice === "emergency_later"}
                onChange={() => setEqSkipChoice("emergency_later")}
                className="accent-[#2C3E2D]"
              />
              <span style={{ color: INK }}>
                Emergency — will complete later
              </span>
            </label>
            <textarea
              value={eqSkipNote}
              onChange={(e) => setEqSkipNote(e.target.value)}
              placeholder="Notes for coordinator…"
              className="admin-premium-textarea w-full text-[12px]"
              style={{ color: INK }}
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEqSkipOpen(false)}
                className="flex-1 py-2 text-[11px] font-semibold border rounded-lg transition-colors"
                style={{ borderColor: BORDER, color: INK }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEquipmentSkip}
                disabled={!eqSkipChoice || eqEquipSubmitting}
                className="flex-1 py-2 text-[11px] font-semibold rounded-lg bg-red-600 text-white disabled:opacity-40"
              >
                Confirm skip
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
