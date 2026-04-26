"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, WarningCircle } from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";
import PageContent from "@/app/admin/components/PageContent";
import { useCrewImmersiveNav } from "@/app/crew/components/CrewImmersiveNavContext";
import {
  EQUIPMENT_TRACKING_UNAVAILABLE_CODE,
  EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE,
  isEquipmentRelationUnavailable,
} from "@/lib/supabase-equipment-errors";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn } from "@/design-system/admin/lib/cn";

const DISPATCH_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";

const CAT_LABEL: Record<string, string> = {
  protection: "Protection",
  tools: "Tools",
  moving: "Moving",
  supplies: "Supplies",
  tech: "Tech",
};

function ImmersiveHeader({ backHref }: { backHref: string }) {
  return (
    <div className="mb-5 flex min-h-[48px] items-center justify-between gap-2">
      <Link
        href={backHref}
        className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 py-1.5 pr-2 text-[12px] font-medium text-[var(--yu3-ink-faint)] transition-colors [font-family:var(--font-body)] hover:text-[var(--yu3-wine)]"
      >
        <CaretLeft size={18} weight="bold" className="shrink-0" aria-hidden />
        Back
      </Link>
      <YugoLogo size={24} variant="wine" onLightBackground />
      <div className="w-12 shrink-0" aria-hidden />
    </div>
  );
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

  const blockedNoList =
    !eqLoading && (equipmentUnavailable || eqLines.length === 0);
  const canSubmitList = !equipmentUnavailable && eqLines.length > 0;

  if (jobReady === null) {
    return (
      <PageContent className="w-full min-w-0 max-w-full">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--yu3-wine)]/25 border-t-[var(--yu3-wine)]" />
            <p className="text-[14px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
              Loading
            </p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (!jobReady) {
    return (
      <PageContent className="mx-auto w-full min-w-0 max-w-lg">
        <ImmersiveHeader backHref={backHref} />
        <h1 className="font-hero text-[24px] font-semibold leading-tight text-[var(--yu3-wine)] sm:text-[26px]">
          Equipment check
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          Complete this job and client sign off first, then you can count what
          is on the truck before the next stop or your end of day.
        </p>
        <Link
          href={backHref}
          className="crew-premium-cta mt-6 inline-flex w-full min-h-[48px] items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] [font-family:var(--font-body)]"
        >
          Back to job
        </Link>
      </PageContent>
    );
  }

  if (alreadyDone) {
    return (
      <PageContent className="mx-auto w-full min-w-0 max-w-lg">
        <ImmersiveHeader backHref={backHref} />
        <div className="text-center">
          <h1 className="font-hero text-[24px] font-semibold text-[var(--yu3-wine)] sm:text-[26px]">
            Already submitted
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            This job already has a submitted or skipped equipment check.
          </p>
          <Link
            href={backHref}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center text-[13px] font-semibold text-[var(--yu3-wine)] underline-offset-2 hover:underline [font-family:var(--font-body)]"
          >
            Back to job
          </Link>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="mx-auto w-full min-w-0 max-w-lg">
      <ImmersiveHeader backHref={backHref} />

      <p className="yu3-t-eyebrow mb-1.5 text-[10px] text-[var(--yu3-wine)]/80 [font-family:var(--font-body)]">
        After sign off
      </p>
      <h1 className="font-hero text-[24px] font-semibold leading-tight text-[var(--yu3-wine)] sm:text-[26px]">
        Truck equipment check
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
        Count what is on the truck. Dispatch is notified if counts do not
        match.
      </p>

      {canSubmitList && eqMsg && !blockedNoList && (
        <div className="mt-4 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-forest-tint)]/30 px-3 py-2.5">
          <p className="text-[14px] leading-snug text-[var(--yu3-ink)] [font-family:var(--font-body)]">
            {eqMsg}
          </p>
        </div>
      )}

      {eqLoading && (
        <p className="mt-6 text-center text-[14px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          Loading equipment
        </p>
      )}

      {!eqLoading && blockedNoList && (
        <div
          className={cn(
            "mt-5 rounded-[var(--yu3-r-xl)] border p-4 sm:p-5",
            equipmentUnavailable
              ? "border-red-200/80 bg-red-50/80"
              : "border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]",
          )}
        >
          <div className="flex gap-3">
            <WarningCircle
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                equipmentUnavailable
                  ? "text-red-600"
                  : "text-[var(--yu3-wine)]",
              )}
              weight="duotone"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-[14px] leading-relaxed text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                {eqMsg?.trim() ||
                  "No equipment list is available for this truck yet."}
              </p>
              <a
                href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                className="crew-premium-cta flex w-full min-h-[48px] items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] [font-family:var(--font-body)]"
              >
                Call dispatch {formatPhone(DISPATCH_PHONE)}
              </a>
            </div>
          </div>
        </div>
      )}

      {!eqLoading && !blockedNoList && (
        <div className="mt-5 space-y-3">
          {["protection", "tools", "moving", "supplies", "tech"].map((cat) => {
            const inCat = eqLines.filter((l) => l.category === cat);
            if (!inCat.length) return null;
            return (
              <div
                key={cat}
                className="overflow-hidden rounded-[12px] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)]"
              >
                <div className="border-b border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
                    {CAT_LABEL[cat] || cat}
                  </p>
                </div>
                <div className="divide-y divide-[var(--yu3-line-subtle)]">
                  {inCat.map((L) => {
                    const actual =
                      eqCounts[L.equipment_id] ?? L.current_quantity;
                    const short = L.current_quantity - actual;
                    const warn = short > 0 && (!L.is_consumable || actual <= 0);
                    return (
                      <div
                        key={L.equipment_id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 text-[14px] font-medium text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                          {L.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            className="admin-premium-input admin-premium-input--compact w-14 text-center text-[14px] tabular-nums"
                            style={{
                              borderBottomColor: warn
                                ? "rgb(248 113 113)"
                                : undefined,
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
                          <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                            of {L.current_quantity}
                          </span>
                          {warn ? (
                            <WarningCircle
                              size={18}
                              className="shrink-0 text-amber-600"
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
          })}
        </div>
      )}

      {!eqLoading &&
        canSubmitList &&
        (() => {
          let needsBatch = false;
          for (const L of eqLines) {
            const actual = eqCounts[L.equipment_id] ?? L.current_quantity;
            const short = L.current_quantity - actual;
            if (short <= 0) continue;
            if (!L.is_consumable || actual <= 0) needsBatch = true;
          }
          return needsBatch ? (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                What happened to missing items?
              </p>
              {(
                [
                  {
                    v: "left_at_client",
                    label: "Left at client (retrieve later)",
                  },
                  { v: "damaged", label: "Damaged during job" },
                  { v: "lost", label: "Lost or cannot locate" },
                  { v: "consumed", label: "Used (consumables)" },
                ] as const
              ).map((o) => (
                <label
                  key={o.v}
                  className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[var(--yu3-ink)] [font-family:var(--font-body)]"
                >
                  <input
                    type="radio"
                    name="eq-batch"
                    checked={eqBatchReason === o.v}
                    onChange={() => setEqBatchReason(o.v)}
                    className="h-4 w-4 accent-[var(--yu3-forest)]"
                  />
                  {o.label}
                </label>
              ))}
              {eqBatchReason === "left_at_client" && (
                <div className="mt-1 space-y-2 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] p-3">
                  <p className="text-[14px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                    Go back now to retrieve?
                  </p>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                    <input
                      type="checkbox"
                      checked={eqLeftRetrieve}
                      onChange={(e) => setEqLeftRetrieve(e.target.checked)}
                      className="h-4 w-4 accent-[var(--yu3-forest)]"
                    />
                    Yes, returning to the client now
                  </label>
                  <p className="text-[12px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                    If unchecked, dispatch is notified to coordinate pickup with
                    the client.
                  </p>
                </div>
              )}
            </div>
          ) : null;
        })()}

      {error ? (
        <div className="mb-3 mt-4 rounded-[var(--yu3-r-lg)] border border-red-200 bg-red-50/90 p-3">
          <p className="text-[14px] font-semibold text-red-800 [font-family:var(--font-body)]">
            {error}
          </p>
        </div>
      ) : null}

      {!equipmentUnavailable && !eqLoading && (
        <div className="mt-6 space-y-3">
          {canSubmitList && (
            <button
              type="button"
              onClick={submitEquipmentCheck}
              disabled={eqEquipSubmitting}
              className="crew-premium-cta w-full min-h-[48px] text-[11px] font-bold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-40 [font-family:var(--font-body)]"
            >
              {eqEquipSubmitting ? "Saving" : "Submit equipment check"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEqSkipOpen(true);
              setError("");
            }}
            className="w-full min-h-[44px] rounded-[var(--yu3-r-md)] border-2 border-[var(--yu3-line-subtle)] bg-transparent px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink)] transition-colors [font-family:var(--font-body)] hover:border-[var(--yu3-wine)]/35 hover:bg-[var(--yu3-wine-tint)]/40"
          >
            Skip check (reason required)
          </button>
        </div>
      )}

      {eqSkipOpen && !equipmentUnavailable ? (
        <div className="mt-4 space-y-3 rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 shadow-[var(--yu3-shadow-sm)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)]/80 [font-family:var(--font-body)]">
            Skip reason
          </p>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
            <input
              type="radio"
              name="eqskip"
              checked={eqSkipChoice === "labour_only"}
              onChange={() => setEqSkipChoice("labour_only")}
              className="h-4 w-4 accent-[var(--yu3-forest)]"
            />
            No equipment used (labour only job)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
            <input
              type="radio"
              name="eqskip"
              checked={eqSkipChoice === "emergency_later"}
              onChange={() => setEqSkipChoice("emergency_later")}
              className="h-4 w-4 accent-[var(--yu3-forest)]"
            />
            Emergency, complete later
          </label>
          <textarea
            value={eqSkipNote}
            onChange={(e) => setEqSkipNote(e.target.value)}
            placeholder="Notes for coordinator"
            className="admin-premium-textarea w-full text-[14px] text-[var(--yu3-ink)] [font-family:var(--font-body)]"
            rows={2}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEqSkipOpen(false)}
              className="min-h-[44px] flex-1 rounded-[var(--yu3-r-md)] border-2 border-[var(--yu3-line-subtle)] text-[12px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)] transition-colors hover:bg-[var(--yu3-bg-surface-sunken)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitEquipmentSkip}
              disabled={!eqSkipChoice || eqEquipSubmitting}
              className="min-h-[44px] flex-1 rounded-[var(--yu3-r-md)] bg-red-600 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 [font-family:var(--font-body)]"
            >
              Confirm skip
            </button>
          </div>
        </div>
      ) : null}
    </PageContent>
  );
}
