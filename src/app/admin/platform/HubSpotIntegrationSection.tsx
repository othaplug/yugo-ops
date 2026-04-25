"use client"

import { useCallback, useEffect, useState } from "react"
import { Icon } from "@/components/AppIcons"
import { useToast } from "../components/Toast"
import { HUBSPOT_PLATFORM_CONFIG_KEYS } from "@/lib/hubspot/hubspot-config-keys"
import AppSettingsCollapsibleSection from "./AppSettingsCollapsibleSection"

const FIELD_HELP: Record<string, { label: string; hint: string }> = {
  hubspot_pipeline_id: {
    label: "Pipeline ID",
    hint: "HubSpot deals pipeline ID (for example OPS+). Required with stage IDs for custom pipelines.",
  },
  hubspot_stage_new_lead: { label: "New lead", hint: "Deal stage when the lead is new." },
  hubspot_stage_contacted: { label: "Contacted", hint: "First contact or engagement." },
  hubspot_stage_quote_draft: { label: "Ready for quote", hint: "Quote is being prepared." },
  hubspot_stage_quote_sent: { label: "Quote sent", hint: "Required for auto deal creation when a quote is sent." },
  hubspot_stage_quote_viewed: { label: "Quote viewed", hint: "Client opened the quote page." },
  hubspot_stage_deposit_received: { label: "Deposit received", hint: "Deposit paid." },
  hubspot_stage_booked: { label: "Booked", hint: "Move is booked." },
  hubspot_stage_scheduled: { label: "Scheduled", hint: "Scheduled on the calendar." },
  hubspot_stage_in_progress: { label: "In progress", hint: "Move or job in progress." },
  hubspot_stage_stalled: { label: "Stalled", hint: "Nurture or paused follow-up." },
  hubspot_stage_closed_won: { label: "Closed won", hint: "Won deal." },
  hubspot_stage_partner_signed: { label: "Partner signed", hint: "Partner agreement signed." },
  hubspot_stage_closed_lost: { label: "Closed lost", hint: "Lost or declined." },
}

export default function HubSpotIntegrationSection() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diag, setDiag] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/hubspot/config", { credentials: "same-origin" })
      const data = (await res.json().catch(() => ({}))) as {
        keys?: Record<string, { value: string }>
        error?: string
      }
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Failed to load HubSpot config", "x")
        return
      }
      const next: Record<string, string> = {}
      for (const k of HUBSPOT_PLATFORM_CONFIG_KEYS) {
        next[k] = data.keys?.[k]?.value ?? ""
      }
      setValues(next)
    } catch {
      toast("Failed to load HubSpot config", "x")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/hubspot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Save failed", "x")
        return
      }
      toast("HubSpot settings saved", "check")
      void load()
    } catch {
      toast("Save failed", "x")
    } finally {
      setSaving(false)
    }
  }

  const handleDiagnose = async () => {
    setDiagLoading(true)
    setDiag(null)
    try {
      const res = await fetch("/api/admin/hubspot/diagnose", { credentials: "same-origin" })
      const data = await res.json().catch(() => ({}))
      setDiag(JSON.stringify(data, null, 2))
    } catch {
      setDiag("Request failed")
    } finally {
      setDiagLoading(false)
    }
  }

  const hubspotTitle = (
    <>
      <Icon name="link" className="w-[14px] h-[14px]" /> HubSpot
    </>
  )

  if (loading) {
    return (
      <AppSettingsCollapsibleSection
        id="app-hubspot"
        title={hubspotTitle}
        subtitle="Pipeline and deal stage IDs for HubSpot CRM sync. Token stays in server environment (HUBSPOT_ACCESS_TOKEN)."
      >
        <p className="text-[12px] text-[var(--tx3)] py-2">Loading HubSpot…</p>
      </AppSettingsCollapsibleSection>
    )
  }

  return (
    <AppSettingsCollapsibleSection
      id="app-hubspot"
      title={hubspotTitle}
      subtitle="Pipeline and deal stage IDs for HubSpot CRM sync. Token stays in server environment (HUBSPOT_ACCESS_TOKEN)."
    >
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
        <div className="space-y-3">
          {HUBSPOT_PLATFORM_CONFIG_KEYS.map((key) => {
            const meta = FIELD_HELP[key] ?? { label: key, hint: "" }
            return (
              <div key={key}>
                <label className="admin-premium-label admin-premium-label--tight">{meta.label}</label>
                {meta.hint ? (
                  <p className="text-[10px] text-[var(--tx3)] mb-1.5">{meta.hint}</p>
                ) : null}
                <input
                  type="text"
                  value={values[key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="admin-premium-input w-full font-mono text-[12px]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="admin-btn admin-btn-primary"
          >
            {saving ? "Saving…" : "Save HubSpot settings"}
          </button>
          <button
            type="button"
            onClick={() => void handleDiagnose()}
            disabled={diagLoading}
            className="px-4 py-2 rounded-lg border border-[var(--admin-primary-fill)] text-[var(--accent-text)] text-[12px] font-semibold hover:bg-[var(--admin-primary-fill)]/10 disabled:opacity-60"
          >
            {diagLoading ? "Running…" : "Run diagnostic"}
          </button>
        </div>
        {diag ? (
          <pre className="text-[10px] font-mono whitespace-pre-wrap rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3 text-[var(--tx2)] max-h-[320px] overflow-auto">
            {diag}
          </pre>
        ) : null}
      </div>
    </AppSettingsCollapsibleSection>
  )
}
