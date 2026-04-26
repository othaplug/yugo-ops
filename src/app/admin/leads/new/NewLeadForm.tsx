"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "../../components/Toast"

const MANUAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "email", label: "Email inquiry" },
  { value: "phone_call", label: "Phone call" },
  { value: "referral", label: "Referral" },
  { value: "partner_referral", label: "Partner referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
]

export const NewLeadForm = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [mSource, setMSource] = useState("email")
  const [mPlatform, setMPlatform] = useState("")
  const [mRef, setMRef] = useState("")
  const [mFirst, setMFirst] = useState("")
  const [mLast, setMLast] = useState("")
  const [mEmail, setMEmail] = useState("")
  const [mPhone, setMPhone] = useState("")
  const [mPaste, setMPaste] = useState("")

  const handleSubmit = async () => {
    if (!mPaste.trim() && !mEmail.trim() && !mPhone.trim()) {
      toast("Paste an inquiry or provide email/phone", "x")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: mSource,
          source_detail: mPlatform.trim()
            ? `Platform: ${mPlatform.trim()}`
            : "Manual entry",
          external_platform: mPlatform.trim() || undefined,
          external_reference: mRef.trim() || undefined,
          first_name: mFirst.trim() || undefined,
          last_name: mLast.trim() || undefined,
          email: mEmail.trim() || undefined,
          phone: mPhone.trim() || undefined,
          raw_inquiry_text: mPaste.trim() || undefined,
          send_acknowledgment: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast("Lead created", "check")
      router.push(`/admin/leads/${(data.lead as { id: string }).id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 text-[12px]">
      <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
        Paste the full email or notes. We will extract contact details; you
        can correct them before saving.
      </p>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Source
        </span>
        <select
          value={mSource}
          onChange={(e) => setMSource(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
        >
          {MANUAL_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Platform (optional)
        </span>
        <input
          value={mPlatform}
          onChange={(e) => setMPlatform(e.target.value)}
          placeholder="MoveBuddy, realtor name…"
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Reference ID (optional)
        </span>
        <input
          value={mRef}
          onChange={(e) => setMRef(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
            First name
          </span>
          <input
            value={mFirst}
            onChange={(e) => setMFirst(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
            Last name
          </span>
          <input
            value={mLast}
            onChange={(e) => setMLast(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Email
        </span>
        <input
          type="email"
          value={mEmail}
          onChange={(e) => setMEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Phone
        </span>
        <input
          value={mPhone}
          onChange={(e) => setMPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
          Paste inquiry
        </span>
        <textarea
          value={mPaste}
          onChange={(e) => setMPaste(e.target.value)}
          rows={4}
          placeholder="Paste email or notes…"
          className="mt-1 w-full min-h-[4.5rem] max-h-32 resize-y rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)] font-mono text-[11px]"
        />
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
          className="px-4 py-2 rounded-lg bg-[var(--tx)] text-[var(--bg)] text-[12px] font-semibold disabled:opacity-50 hover:opacity-90"
        >
          {busy ? "Creating…" : "Create lead"}
        </button>
      </div>
    </div>
  )
}
