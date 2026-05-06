"use client"

import { useCallback, useEffect, useState } from "react"
import { Icon } from "@/components/AppIcons"
import { useToast } from "../components/Toast"
import AppSettingsCollapsibleSection from "./AppSettingsCollapsibleSection"

type SyncCount = { created: number; updated: number; deleted: number; skipped: number; error: number }
type SyncResult = { id: string; code: string; action: string; error?: string }
type StatusData = {
  configured: boolean
  calendarId: string | null
  clientEmail: string | null
  testOk?: boolean
  testError?: string
  calendarSummary?: string | null
  hint?: string | null
}

export default function GoogleCalendarSection() {
  const { toast } = useToast()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [lastSync, setLastSync] = useState<{ counts: SyncCount; results: SyncResult[] } | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gcal/sync", { credentials: "same-origin" })
      if (res.ok) {
        const d = await res.json() as StatusData
        setStatus(d)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/gcal/sync?test=true", { credentials: "same-origin" })
      const d = await res.json() as StatusData
      setStatus(d)
      if (d.testOk) {
        toast(`Connected — calendar: ${d.calendarSummary || d.calendarId}`, "check")
      } else {
        toast(d.testError ?? "Connection failed", "x")
      }
    } catch {
      toast("Test request failed", "x")
    } finally {
      setTesting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setLastSync(null)
    try {
      const res = await fetch("/api/admin/gcal/sync", {
        method: "POST",
        credentials: "same-origin",
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string; counts?: SyncCount; results?: SyncResult[] }
      if (!res.ok || !data.success) {
        toast(data.error ?? "Sync failed", "x")
        return
      }
      setLastSync({ counts: data.counts!, results: data.results ?? [] })
      const c = data.counts!
      toast(`Synced: ${c.created} created · ${c.updated} updated · ${c.error} errors`, c.error > 0 ? "alertTriangle" : "check")
    } catch {
      toast("Sync request failed", "x")
    } finally {
      setSyncing(false)
    }
  }

  const calTitle = (
    <>
      <Icon name="calendar" className="w-[14px] h-[14px]" /> Google Calendar
    </>
  )

  const configured = status?.configured ?? false

  return (
    <AppSettingsCollapsibleSection
      id="app-gcal"
      title={calTitle}
      subtitle="Sync confirmed and booked moves and B2B jobs to a shared Google Calendar."
    >
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">

        {/* Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
              status?.testOk === true ? "bg-green-500" :
              status?.testOk === false ? "bg-red-500" :
              configured ? "bg-green-500" : "bg-amber-400"
            }`} />
            <div className="space-y-0.5">
              <p className="text-[12px] font-semibold text-[var(--tx)]">
                {status?.testOk === true
                  ? `Connected · ${status.calendarSummary || "Calendar found"}`
                  : status?.testOk === false
                  ? "Connection failed"
                  : configured ? "Env vars set — not tested yet" : "Not configured"}
              </p>
              {status?.clientEmail ? (
                <p className="text-[11px] text-[var(--tx3)] font-mono">{status.clientEmail}</p>
              ) : null}
              {status?.calendarId ? (
                <p className="text-[11px] text-[var(--tx3)] font-mono">{status.calendarId}</p>
              ) : null}
              {status?.testError ? (
                <p className="text-[11px] text-red-500 font-mono mt-1">{status.testError}</p>
              ) : null}
              {status?.hint ? (
                <p className="text-[11px] text-amber-500 mt-1">{status.hint}</p>
              ) : null}
            </div>
          </div>
          {configured && (
            <button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={testing}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide border border-[var(--brd)] px-2 py-1 rounded text-[var(--tx2)] hover:bg-[var(--bg2)] disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>

        {/* Setup instructions when not configured */}
        {!configured && (
          <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-4 space-y-3 text-[11px] text-[var(--tx2)] leading-relaxed">
            <p className="font-semibold text-[var(--tx)] text-[12px]">Setup (3 steps)</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <span className="font-medium text-[var(--tx)]">Create a Google Cloud service account</span>
                {" "}— Google Cloud Console → IAM → Service Accounts → Create → download JSON key.
              </li>
              <li>
                <span className="font-medium text-[var(--tx)]">Share your Google Calendar</span>
                {" "}— open the calendar settings, "Share with specific people", add the service account email with "Make changes to events".
              </li>
              <li>
                <span className="font-medium text-[var(--tx)]">Add 3 environment variables</span>
                {" "}to your deployment (Vercel → Settings → Environment Variables):
                <div className="mt-1.5 font-mono text-[10px] bg-[var(--card)] rounded-md border border-[var(--brd)] p-2.5 space-y-1 select-all">
                  <div>GOOGLE_CALENDAR_CLIENT_EMAIL=<span className="text-[var(--tx3)]">service@project.iam.gserviceaccount.com</span></div>
                  <div>GOOGLE_CALENDAR_PRIVATE_KEY=<span className="text-[var(--tx3)]">"-----BEGIN RSA PRIVATE KEY-----\n..."</span></div>
                  <div>GOOGLE_CALENDAR_ID=<span className="text-[var(--tx3)]">your-calendar-id@group.calendar.google.com</span></div>
                </div>
                <p className="mt-1.5 text-[10px] text-[var(--tx3)]">
                  The GOOGLE_CALENDAR_ID is in Calendar Settings → "Integrate calendar" → Calendar ID. Redeploy after adding vars.
                </p>
              </li>
            </ol>
          </div>
        )}

        {/* Sync controls */}
        {configured && (
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
              Syncs all confirmed and booked moves and B2B deliveries to the shared calendar.
              New jobs are added automatically on payment. Use this button to backfill existing jobs or fix drift.
            </p>
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="admin-btn admin-btn-primary"
            >
              {syncing ? "Syncing…" : "Sync all booked jobs now"}
            </button>

            {lastSync && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3 text-[11px]">
                  {(["created", "updated", "skipped", "error"] as const).map((k) => (
                    <span key={k} className={`font-medium ${k === "error" && lastSync.counts.error > 0 ? "text-red-600" : "text-[var(--tx2)]"}`}>
                      {lastSync.counts[k]} {k}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-[10px] text-[var(--tx3)] underline underline-offset-2"
                >
                  {showDetails ? "Hide" : "Show"} details
                </button>
                {showDetails && (
                  <div className="max-h-48 overflow-auto rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-2.5 space-y-0.5">
                    {lastSync.results.map((r) => (
                      <div key={r.id} className="flex items-baseline gap-2 text-[10px] font-mono">
                        <span className={`shrink-0 ${r.action === "error" ? "text-red-600" : r.action === "skipped" ? "text-[var(--tx3)]" : "text-green-600"}`}>
                          {r.action}
                        </span>
                        <span className="text-[var(--tx2)]">{r.code}</span>
                        {r.error && <span className="text-red-500 truncate">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppSettingsCollapsibleSection>
  )
}
