"use client"

import { useCallback, useEffect, useState } from "react"
import { Icon } from "@/components/AppIcons"
import { useToast } from "../components/Toast"
import { HUBSPOT_PLATFORM_CONFIG_KEYS } from "@/lib/hubspot/hubspot-config-keys"
import AppSettingsCollapsibleSection from "./AppSettingsCollapsibleSection"

function GenerateQuoteUrlBanner() {
  const [copied, setCopied] = useState(false)
  const url = `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")}/admin/quotes/new?hubspot_deal_id={DEAL_ID}`

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-amber-800">HubSpot CRM Card — Generate Quote URL</p>
      <p className="text-[11px] text-amber-700 leading-relaxed">
        If your HubSpot &quot;Generate Quote&quot; button is not opening or is loading the wrong domain, update the button URL in your HubSpot CRM card settings to:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[10px] font-mono bg-white border border-amber-200 rounded px-2 py-1.5 text-amber-900 break-all">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-[10px] text-amber-600">Replace <code className="font-mono">{"{DEAL_ID}"}</code> with your HubSpot deal ID token (e.g. <code className="font-mono">{"{{deal.hs_object_id}}"}</code>).</p>
    </div>
  )
}

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
  const [autoConfigLoading, setAutoConfigLoading] = useState(false)
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

  const handleAutoConfig = async () => {
    setAutoConfigLoading(true)
    setDiag(null)
    try {
      const res = await fetch("/api/admin/hubspot/configure-pipeline", {
        method: "POST",
        credentials: "same-origin",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast((data as { error?: string }).error ?? "Auto-configure failed", "x")
        setDiag(JSON.stringify(data, null, 2))
        return
      }
      toast(`Configured ${(data as { configured?: unknown[] }).configured?.length ?? 0} stage IDs from HubSpot`, "check")
      setDiag(JSON.stringify(data, null, 2))
      void load()
    } catch {
      toast("Auto-configure request failed", "x")
    } finally {
      setAutoConfigLoading(false)
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
        <GenerateQuoteUrlBanner />
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
            onClick={() => void handleAutoConfig()}
            disabled={autoConfigLoading}
            className="px-4 py-2 rounded-lg border border-[var(--admin-primary-fill)] text-[var(--accent-text)] text-[12px] font-semibold hover:bg-[var(--admin-primary-fill)]/10 disabled:opacity-60"
          >
            {autoConfigLoading ? "Fetching from HubSpot…" : "Auto-configure stages from HubSpot"}
          </button>
          <button
            type="button"
            onClick={() => void handleDiagnose()}
            disabled={diagLoading}
            className="px-4 py-2 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-semibold hover:bg-[var(--bg)] disabled:opacity-60"
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
