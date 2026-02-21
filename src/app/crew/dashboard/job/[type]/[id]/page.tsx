"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MOVE_STATUS_FLOW,
  DELIVERY_STATUS_FLOW,
  getNextStatus,
  getStatusLabel,
} from "@/lib/crew-tracking-status";
import { normalizePhone } from "@/lib/phone";
import PageContent from "@/app/admin/components/PageContent";
import JobPhotos from "./JobPhotos";
import JobInventory from "./JobInventory";

const DISPATCH_PHONE = "(647) 370-4525";

interface JobDetail {
  id: string;
  jobId: string;
  jobType: "move" | "delivery";
  clientName: string;
  fromAddress: string;
  toAddress: string;
  access: string | null;
  jobTypeLabel: string;
  inventory: { room: string; items: string[] }[];
  extraItems?: { id: string; description?: string; room?: string; quantity?: number; added_at?: string }[];
  internalNotes: string | null;
  scheduledTime: string | null;
  crewId: string;
}

interface Session {
  id: string;
  status: string;
  isActive: boolean;
  startedAt: string | null;
  checkpoints: { status: string; timestamp: string; note: string | null }[];
  lastLocation: { lat: number; lng: number } | null;
}

export default function CrewJobPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const [job, setJob] = useState<JobDetail | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [note, setNote] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"off" | "on" | "unavailable">("off");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("damage");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const statusFlow = jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  const currentStatus = session?.status || "not_started";
  const nextStatus = getNextStatus(currentStatus, jobType);
  const isCompleted = currentStatus === "completed";

  const fetchJob = useCallback(async () => {
    const r = await fetch(`/api/crew/job/${jobType}/${id}`);
    if (!r.ok) throw new Error("Job not found");
    const d = await r.json();
    setJob(d);
  }, [jobType, id]);

  const fetchSession = useCallback(async () => {
    const r = await fetch(`/api/crew/session/${jobType}/${id}`);
    const d = await r.json();
    if (d.session) {
      setSession({
        id: d.session.id,
        status: d.session.status,
        isActive: d.session.isActive,
        startedAt: d.session.startedAt,
        checkpoints: d.checkpoints || [],
        lastLocation: d.lastLocation,
      });
    } else {
      setSession(null);
    }
  }, [id, jobType]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchJob(), fetchSession()])
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchJob, fetchSession]);

  useEffect(() => {
    const interval = setInterval(fetchSession, 15000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const startJob = async () => {
    setAdvancing(true);
    try {
      const r = await fetch("/api/tracking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, jobType }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to start");
      await fetchSession();
      setGpsStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdvancing(false);
    }
  };

  const advanceStatus = async () => {
    if (!session || !nextStatus) return;
    if (nextStatus === "completed") {
      setConfirmComplete(true);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => doAdvance(nextStatus, p.coords.latitude, p.coords.longitude),
        () => doAdvance(nextStatus),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
      );
    } else {
      await doAdvance(nextStatus);
    }
  };

  const doAdvance = async (status: string, lat?: number, lng?: number) => {
    if (!session) return;
    setAdvancing(true);
    setConfirmComplete(false);
    try {
      const r = await fetch("/api/tracking/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          status,
          note: note.trim() || undefined,
          lat,
          lng,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setNote("");
      await fetchSession();
      if (status === "completed") {
        stopGpsTracking();
        setGpsStatus("off");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdvancing(false);
    }
  };

  const watchIdRef = { current: null as number | null };
  const lastSentRef = { current: 0 };
  const SEND_INTERVAL = 30000;

  const startGpsTracking = (sessionId: string) => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < SEND_INTERVAL) return;
        lastSentRef.current = now;
        fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      },
      () => setGpsStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    if (session?.isActive && session.id && gpsStatus === "on") {
      startGpsTracking(session.id);
    }
    return () => stopGpsTracking();
  }, [session?.id, session?.isActive, gpsStatus]);

  // Wake Lock
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestLock();
    return () => { lock?.release?.(); };
  }, []);

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-[14px] text-[var(--tx3)]">Loading…</p>
        </div>
      </PageContent>
    );
  }

  if (error || !job) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-[14px] text-[var(--red)] mb-4">{error || "Job not found"}</p>
          <Link href="/crew/dashboard" className="text-[13px] text-[var(--gold)] hover:underline">
            ← Back to Jobs
          </Link>
        </div>
      </PageContent>
    );
  }

  const showStartButton = !session;
  const showAdvanceButton = session?.isActive && nextStatus && !showStartButton;

  return (
    <PageContent className="max-w-[520px]">
      <Link
        href="/crew/dashboard"
        className="inline-flex items-center gap-1.5 py-2 text-[12px] text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
      >
        ← Back to Jobs
      </Link>

      <h1 className="font-hero text-[20px] font-bold text-[var(--tx)] mt-2">{job.clientName}</h1>
      <p className="text-[12px] text-[var(--tx3)] mt-0.5">
        {job.jobId} · {job.jobTypeLabel}
      </p>

      <div className="mt-4 space-y-2 text-[13px] text-[var(--tx2)]">
        <div><span className="text-[var(--tx3)]">FROM:</span> {job.fromAddress}</div>
        <div><span className="text-[var(--tx3)]">TO:</span> {job.toAddress}</div>
        {job.access && (
          <div><span className="text-[var(--tx3)]">ACCESS:</span> {job.access}</div>
        )}
      </div>

      {session && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-[var(--tx3)]">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gpsStatus === "on" ? "bg-[var(--grn)]" : "bg-[var(--tx3)]"}`} />
          <span>
            Location sharing: {gpsStatus === "on" ? "ON" : gpsStatus === "unavailable" ? "Unavailable" : "OFF"}
          </span>
        </div>
      )}

      <div className="mt-6">
        {showStartButton && (
          <button
            onClick={startJob}
            disabled={advancing}
            className="w-full py-4 rounded-xl font-semibold text-[15px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
          >
            {advancing ? "Starting…" : "START JOB →"}
          </button>
        )}
        {showAdvanceButton && (
          <button
            onClick={advanceStatus}
            disabled={advancing}
            className="w-full py-4 rounded-xl font-semibold text-[15px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
          >
            {advancing ? "Updating…" : `${getStatusLabel(nextStatus!)} →`}
          </button>
        )}
        {isCompleted && (
          <div className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--grn)] text-center bg-[rgba(45,159,90,0.15)]">
            ✓ Completed
          </div>
        )}
      </div>

      {showAdvanceButton && (
        <div className="mt-3">
          <input
            type="text"
            placeholder="Add note... (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
      )}

      {session?.isActive && (
        <JobPhotos
          jobId={id}
          jobType={jobType}
          sessionId={session?.id ?? null}
          currentStatus={currentStatus}
        />
      )}

      <div className="mt-6">
        <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Timeline</h2>
        <div className="space-y-2">
          {statusFlow.map((s, i) => {
            const cp = session?.checkpoints?.find((c) => c.status === s);
            const isCurrent = currentStatus === s;
            const isPast = statusFlow.indexOf(currentStatus as any) > i;
            return (
              <div key={s} className="flex items-center gap-3 text-[12px]">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                    isPast ? "bg-[var(--grn)] text-white" : isCurrent ? "bg-[var(--gold)] text-[#0D0D0D]" : "bg-[var(--brd)] text-[var(--tx3)]"
                  }`}
                >
                  {isPast ? "✓" : i + 1}
                </span>
                <span className={isPast || isCurrent ? "text-[var(--tx)]" : "text-[var(--tx3)]"}>
                  {getStatusLabel(s)}
                </span>
                {cp?.timestamp && (
                  <span className="text-[10px] text-[var(--tx3)] ml-auto">
                    {new Date(cp.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {job.internalNotes && (
        <div className="mt-6">
          <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Notes from dispatch</h2>
          <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap">{job.internalNotes}</p>
        </div>
      )}

      {(job.inventory?.length > 0 || job.extraItems?.length) && (
        <JobInventory
          jobId={id}
          jobType={jobType}
          inventory={job.inventory || []}
          extraItems={job.extraItems || []}
          currentStatus={currentStatus}
          onRefresh={fetchJob}
        />
      )}

      {["unloading", "delivering"].includes(currentStatus) && !isCompleted && (
        <Link
          href={`/crew/dashboard/job/${jobType}/${id}/signoff`}
          className="mt-6 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px] text-[#0D0D0D] bg-[#C9A962] hover:bg-[#D4B56C] transition-colors"
        >
          Client Sign-Off
        </Link>
      )}

      <a
        href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
        className="mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-[var(--brd)] text-[13px] font-medium text-[var(--tx)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
      >
        📞 Call Dispatch
      </a>

      <button
        onClick={() => setReportModalOpen(true)}
        className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-[#D48A29]/40 text-[13px] font-medium text-[#D48A29] bg-[rgba(212,138,41,0.08)] hover:bg-[rgba(212,138,41,0.12)] transition-colors"
      >
        ⚠️ Report Issue
      </button>

      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-[340px] w-full">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-2">Report Issue</h3>
            {reportSubmitted ? (
              <div className="py-4">
                <p className="text-[13px] text-[var(--grn)] mb-4">Issue reported. Dispatch will be notified.</p>
                <button
                  onClick={() => { setReportModalOpen(false); setReportSubmitted(false); setReportDesc(""); }}
                  className="w-full py-2.5 rounded-lg bg-[var(--gold)] text-[#0D0D0D] font-semibold hover:bg-[var(--gold2)]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Issue type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
                  >
                    <option value="damage">Damage</option>
                    <option value="delay">Delay</option>
                    <option value="missing_item">Missing item</option>
                    <option value="access_problem">Access problem</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Description (optional)</label>
                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Describe what happened..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx)] text-[13px] hover:bg-[var(--card)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setReportSubmitting(true);
                      try {
                        const r = await fetch("/api/crew/incident", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            jobId: job.id,
                            jobType,
                            sessionId: session?.id,
                            issueType: reportType,
                            description: reportDesc.trim() || undefined,
                          }),
                        });
                        if (!r.ok) throw new Error("Failed");
                        setReportSubmitted(true);
                      } catch {
                        setReportSubmitting(false);
                      }
                    }}
                    disabled={reportSubmitting}
                    className="flex-1 py-2.5 rounded-lg bg-[#D48A29] text-[#0D0D0D] font-semibold disabled:opacity-50"
                  >
                    {reportSubmitting ? "Sending…" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmComplete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-[340px] w-full">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-2">Mark as complete?</h3>
            <p className="text-[13px] text-[var(--tx3)] mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmComplete(false)}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-medium border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--card)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      (p) => doAdvance("completed", p.coords.latitude, p.coords.longitude),
                      () => doAdvance("completed"),
                      { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
                    );
                  } else {
                    doAdvance("completed");
                  }
                }}
                disabled={advancing}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-[#0D0D0D] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContent>
  );
}
