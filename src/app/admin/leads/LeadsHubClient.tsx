"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  COMPLETENESS_PATH_LABELS,
  LEAD_ACTIVITY_LABELS,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/admin-labels";
import { useToast } from "../components/Toast";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";
import {
  ArrowRight,
  ChartBar,
  CheckCircle,
  Clock,
  Funnel,
  Lightning,
  List,
  Phone,
  Plus,
  User,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

export type LeadRow = {
  id: string;
  lead_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  source_detail: string | null;
  service_type: string | null;
  move_size: string | null;
  preferred_date: string | null;
  from_address: string | null;
  to_address: string | null;
  status: string;
  priority: string;
  created_at: string;
  first_response_at: string | null;
  quote_uuid: string | null;
  completeness_path?: string | null;
  completeness_score?: number | null;
  recommended_tier?: string | null;
  intelligence_summary?: string | null;
  parsed_inventory?: unknown;
  follow_up_sent_at?: string | null;
  fields_missing?: unknown;
  clarifications_needed?: unknown;
  detected_dates?: unknown;
  estimated_value?: number | null;
};

type Metrics = {
  todayByStatus: Record<string, number>;
  avgResponseMin: number | null;
  pctUnder5min: number | null;
  pctUnder15min: number | null;
  pctOver1hr: number | null;
  funnel: {
    received: number;
    contacted: number;
    quote_sent: number;
    converted: number;
    lost: number;
    stale: number;
  };
  bySource: Record<string, { count: number; converted: number; valueSum: number }>;
  speedVsConversion: { label: string; leads: number; converted: number; rate: number }[];
  recentActivity: {
    id: string;
    activity_type: string;
    notes: string | null;
    created_at: string;
    lead_id: string;
    lead_number: string | null;
    lead_name: string;
  }[];
};

function sourceLabel(source: string, detail: string | null | undefined) {
  const d = (detail || "").trim();
  if (d) return d;
  return LEAD_SOURCE_LABELS[source] || source.replace(/_/g, " ");
}

function digitsOnly(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function telHref(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `tel:+${d}`;
  return null;
}

function smsHref(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  if (d.length === 10) return `sms:+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `sms:+${d}`;
  return null;
}

function LeadElapsedTimer({ createdAt }: { createdAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const color =
    sec <= 300
      ? "text-emerald-500"
      : sec <= 900
        ? "text-amber-400"
        : sec <= 3600
          ? "text-orange-400"
          : "text-red-400";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const label = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span className={`tabular-nums font-mono text-[13px] font-bold ${color}`} title="Time since lead arrived">
      {label}
    </span>
  );
}

function pathIcon(path: string | null | undefined) {
  const p = path || "manual_review";
  if (p === "auto_quote") return { Icon: CheckCircle, className: "text-emerald-500" };
  if (p === "needs_info") return { Icon: WarningCircle, className: "text-amber-400" };
  return { Icon: XCircle, className: "text-red-400" };
}

function parsedInvCount(lead: LeadRow): number | null {
  const raw = lead.parsed_inventory;
  if (!Array.isArray(raw)) return null;
  return raw.length;
}

const MANUAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "email", label: "Email inquiry" },
  { value: "phone_call", label: "Phone call" },
  { value: "referral", label: "Referral" },
  { value: "partner_referral", label: "Partner referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
];

export default function LeadsHubClient({ mode }: { mode: "dashboard" | "all" | "mine" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [attention, setAttention] = useState<LeadRow[]>([]);
  const [list, setList] = useState<LeadRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [mSource, setMSource] = useState("email");
  const [mPlatform, setMPlatform] = useState("");
  const [mRef, setMRef] = useState("");
  const [mFirst, setMFirst] = useState("");
  const [mLast, setMLast] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mPaste, setMPaste] = useState("");

  const refresh = useCallback(async () => {
    setLoadErr(null);
    try {
      const [mRes, aRes, lRes] = await Promise.all([
        mode === "dashboard" ? fetch("/api/admin/leads/metrics") : Promise.resolve(null as Response | null),
        mode === "dashboard"
          ? fetch("/api/admin/leads?attention=1&limit=50")
          : Promise.resolve(null as Response | null),
        mode !== "dashboard"
          ? fetch(mode === "mine" ? "/api/admin/leads?mine=1&limit=300" : "/api/admin/leads?limit=300")
          : Promise.resolve(null as Response | null),
      ]);
      if (mRes) {
        const mj = await mRes.json();
        if (!mRes.ok) throw new Error(mj.error || "Metrics failed");
        setMetrics(mj);
      }
      if (aRes) {
        const aj = await aRes.json();
        if (!aRes.ok) throw new Error(aj.error || "Leads failed");
        setAttention((aj.leads || []) as LeadRow[]);
      }
      if (lRes) {
        const lj = await lRes.json();
        if (!lRes.ok) throw new Error(lj.error || "Leads failed");
        setList((lj.leads || []) as LeadRow[]);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, () => {
        refresh();
        router.refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, () => {
        refresh();
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, router]);

  const todayRow = useMemo(() => {
    if (!metrics?.todayByStatus) return { new: 0, contacted: 0, quote_sent: 0, converted: 0, lost: 0 };
    const t = metrics.todayByStatus;
    return {
      new:
        (t.new ?? 0) +
        (t.assigned ?? 0) +
        (t.follow_up_sent ?? 0) +
        (t.awaiting_reply ?? 0),
      contacted: t.contacted ?? 0,
      quote_sent: t.quote_sent ?? 0,
      converted: t.converted ?? 0,
      lost: t.lost ?? 0,
    };
  }, [metrics]);

  const subNav = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/admin/leads"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
          mode === "dashboard"
            ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)]"
            : "border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--gdim)]"
        }`}
      >
        <ChartBar size={16} aria-hidden />
        Dashboard
      </Link>
      <Link
        href="/admin/leads/all"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
          mode === "all"
            ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)]"
            : "border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--gdim)]"
        }`}
      >
        <List size={16} aria-hidden />
        All Leads
      </Link>
      <Link
        href="/admin/leads/mine"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
          mode === "mine"
            ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)]"
            : "border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--gdim)]"
        }`}
      >
        <User size={16} aria-hidden />
        My Leads
      </Link>
    </div>
  );

  const submitManualLead = async () => {
    if (!mPaste.trim() && !mEmail.trim() && !mPhone.trim()) {
      toast("Paste an inquiry or provide email/phone", "x");
      return;
    }
    setManualBusy(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: mSource,
          source_detail: mPlatform.trim() ? `Platform: ${mPlatform.trim()}` : "Manual entry",
          external_platform: mPlatform.trim() || undefined,
          external_reference: mRef.trim() || undefined,
          first_name: mFirst.trim() || undefined,
          last_name: mLast.trim() || undefined,
          email: mEmail.trim() || undefined,
          phone: mPhone.trim() || undefined,
          raw_inquiry_text: mPaste.trim() || undefined,
          send_acknowledgment: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast("Lead created", "check");
      setManualOpen(false);
      setMPaste("");
      setMPlatform("");
      setMRef("");
      refresh();
      router.push(`/admin/leads/${(data.lead as { id: string }).id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setManualBusy(false);
    }
  };

  function LeadActionCard({ lead }: { lead: LeadRow }) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
    const tel = telHref(lead.phone);
    const sms = smsHref(lead.phone);
    const quoteHref = `/admin/quotes/new?lead_id=${encodeURIComponent(lead.id)}`;
    const path = lead.completeness_path || "manual_review";
    const { Icon: PathIc, className: pathCls } = pathIcon(path);
    const invN = parsedInvCount(lead);
    const missing = Array.isArray(lead.fields_missing) ? (lead.fields_missing as string[]).slice(0, 3) : [];
    const clar = Array.isArray(lead.clarifications_needed)
      ? (lead.clarifications_needed as string[]).slice(0, 2)
      : [];

    return (
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="shrink-0" title={COMPLETENESS_PATH_LABELS[path] || path}>
                <PathIc className={`w-4 h-4 ${pathCls}`} weight="fill" aria-hidden />
              </span>
              <Clock size={16} className="text-[var(--tx3)] shrink-0" aria-hidden />
              <LeadElapsedTimer createdAt={lead.created_at} />
              <span className="text-[13px] font-bold text-[var(--tx)] truncate">
                {lead.lead_number} — {name}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-[var(--tx2)] mt-1">
              {COMPLETENESS_PATH_LABELS[path] || path}
              {lead.status === "follow_up_sent" ? " · Follow-up sent" : ""}
            </p>
            <p className="text-[11px] text-[var(--tx3)] mt-1">
              {lead.phone || "—"} | {lead.move_size || "—"} | {lead.preferred_date || "—"}
            </p>
            {lead.intelligence_summary ? (
              <p className="text-[10px] text-[var(--tx2)] mt-1 line-clamp-2">{lead.intelligence_summary}</p>
            ) : null}
            {invN != null && invN > 0 ? (
              <p className="text-[10px] text-[var(--tx3)] mt-0.5">{invN} inventory line(s) parsed</p>
            ) : null}
            {lead.recommended_tier ? (
              <p className="text-[10px] text-amber-400/90 mt-0.5">Recommend: {String(lead.recommended_tier).toUpperCase()}</p>
            ) : null}
            {missing.length > 0 ? (
              <p className="text-[10px] text-orange-400/90 mt-0.5">Missing: {missing.join(", ")}</p>
            ) : null}
            {clar.length > 0 ? (
              <p className="text-[10px] text-[var(--tx3)] mt-0.5 line-clamp-2">{clar.join(" · ")}</p>
            ) : null}
            {lead.follow_up_sent_at ? (
              <p className="text-[10px] text-amber-400/80 mt-0.5">
                Client follow-up sent {new Date(lead.follow_up_sent_at).toLocaleString()}
              </p>
            ) : null}
            <p className="text-[11px] text-[var(--tx2)] mt-0.5">
              Source: {sourceLabel(lead.source, lead.source_detail)}
              {lead.source === "google_ads" && (
                <span className="ml-1 text-amber-400 font-semibold">Paid</span>
              )}
              {lead.source === "phone_call" && (lead.source_detail || "").toLowerCase().includes("miss") && (
                <span className="ml-1 text-red-400 font-semibold">Call back</span>
              )}
            </p>
            {lead.priority === "urgent" || lead.priority === "high" ? (
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-orange-400">
                {LEAD_PRIORITY_LABELS[lead.priority] || lead.priority}
              </span>
            ) : null}
          </div>
          <Link
            href={`/admin/leads/${lead.id}`}
            className="text-[11px] font-semibold text-[var(--gold)] hover:underline shrink-0"
          >
            Details
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={quoteHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--gold)] text-white text-[11px] font-bold hover:opacity-90"
          >
            Send Quote
            <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
          {tel ? (
            <a
              href={tel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--gdim)]"
            >
              <Phone size={14} aria-hidden />
              Call
            </a>
          ) : null}
          {sms ? (
            <a
              href={sms}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--gdim)]"
            >
              SMS
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-5 md:py-6">
      <div className="mb-2 flex items-center gap-2">
        <Funnel size={22} className="text-[var(--gold)]" weight="duotone" aria-hidden />
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)]">Revenue</p>
          <h1 className="font-hero text-xl md:text-2xl font-bold text-[var(--tx)] tracking-tight">Leads</h1>
        </div>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mb-4 max-w-xl">
        Speed to lead: respond in under five minutes when you can — it drives conversion.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {subNav}
        {(mode === "dashboard" || mode === "all") && (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--gold)]/50 text-[var(--gold)] hover:bg-[var(--gold)]/10"
          >
            <Plus size={16} weight="bold" aria-hidden />
            Add lead manually
          </button>
        )}
      </div>

      {loadErr && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-[12px]">{loadErr}</div>
      )}

      {mode === "dashboard" && metrics && (
        <>
          <section className="mb-8">
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3 flex items-center gap-2">
              <Lightning size={16} className="text-[var(--gold)]" aria-hidden />
              Speed to lead — today
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {[
                { k: "new", label: "Attention" },
                { k: "contacted", label: "Contacted" },
                { k: "quote_sent", label: "Quote sent" },
                { k: "converted", label: "Converted" },
                { k: "lost", label: "Lost" },
              ].map(({ k, label }) => (
                <div key={k} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3 text-center">
                  <div className="text-xl font-bold text-[var(--gold)] tabular-nums">{todayRow[k as keyof typeof todayRow]}</div>
                  <div className="text-[10px] text-[var(--tx3)] uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-4 py-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[var(--tx2)]">Avg response time (this month):</span>
              <span className="text-[14px] font-bold text-[var(--tx)]">
                {metrics.avgResponseMin != null ? `${metrics.avgResponseMin} min` : "—"}
              </span>
              <span className="text-[11px] text-[var(--tx3)]">(target &lt; 5 min)</span>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">Needs attention</h2>
            <p className="text-[11px] text-[var(--tx3)] mb-3">
              Open leads without a quote (new, assigned, follow-up sent, awaiting reply), oldest first. Timer updates live.
            </p>
            {attention.length === 0 ? (
              <p className="text-[13px] text-[var(--tx2)] py-6 text-center border border-dashed border-[var(--brd)] rounded-xl">No leads waiting — great job.</p>
            ) : (
              <div className="space-y-3">
                {attention.map((lead) => (
                  <LeadActionCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">This month — funnel</h2>
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 text-[12px] text-[var(--tx2)] space-y-1">
              <p>Leads received: {metrics.funnel.received}</p>
              <p>Contacted: {metrics.funnel.contacted}</p>
              <p>Quote sent: {metrics.funnel.quote_sent}</p>
              <p>Converted: {metrics.funnel.converted}</p>
              <p>Lost: {metrics.funnel.lost}</p>
              <p>Stale: {metrics.funnel.stale}</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">Response quality</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 text-[12px]">
                <p className="font-semibold text-[var(--tx)] mb-2">Buckets</p>
                <ul className="space-y-1 text-[var(--tx2)]">
                  <li>&lt; 5 min: {metrics.pctUnder5min != null ? `${metrics.pctUnder5min}%` : "—"}</li>
                  <li>&lt; 15 min: {metrics.pctUnder15min != null ? `${metrics.pctUnder15min}%` : "—"}</li>
                  <li>&gt; 1 hr: {metrics.pctOver1hr != null ? `${metrics.pctOver1hr}%` : "—"}</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 overflow-x-auto">
                <p className="font-semibold text-[var(--tx)] mb-2 text-[12px]">Speed vs conversion</p>
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="text-[var(--tx3)] border-b border-[var(--brd)]">
                      <th className="py-1.5 pr-2">Window</th>
                      <th className="py-1.5 pr-2">Leads</th>
                      <th className="py-1.5 pr-2">Converted</th>
                      <th className="py-1.5">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--tx2)]">
                    {metrics.speedVsConversion.map((row) => (
                      <tr key={row.label} className="border-b border-[var(--brd)]/60">
                        <td className="py-1.5 pr-2">{row.label}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{row.leads}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{row.converted}</td>
                        <td className="py-1.5 tabular-nums">{row.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">By source</h2>
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 overflow-x-auto">
              <table className="w-full text-[11px] text-left min-w-[420px]">
                <thead>
                  <tr className="text-[var(--tx3)] border-b border-[var(--brd)]">
                    <th className="py-1.5 pr-2">Source</th>
                    <th className="py-1.5 pr-2">Leads</th>
                    <th className="py-1.5 pr-2">Converted</th>
                    <th className="py-1.5 pr-2">Rate</th>
                    <th className="py-1.5">Avg value</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--tx2)]">
                  {Object.entries(metrics.bySource)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([src, v]) => (
                      <tr key={src} className="border-b border-[var(--brd)]/60">
                        <td className="py-1.5 pr-2">{LEAD_SOURCE_LABELS[src] || src}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{v.count}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{v.converted}</td>
                        <td className="py-1.5 pr-2 tabular-nums">
                          {v.count ? Math.round((v.converted / v.count) * 100) : 0}%
                        </td>
                        <td className="py-1.5 tabular-nums">
                          {v.count ? `$${Math.round(v.valueSum / v.count).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">Recent activity</h2>
            <ul className="space-y-2 text-[12px] text-[var(--tx2)]">
              {(metrics.recentActivity || []).slice(0, 12).map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 border-b border-[var(--brd)]/40 pb-2">
                  <Link href={`/admin/leads/${a.lead_id}`} className="font-semibold text-[var(--gold)] hover:underline">
                    {a.lead_number || "Lead"}
                  </Link>
                  <span>— {LEAD_ACTIVITY_LABELS[a.activity_type] || a.activity_type}</span>
                  <span className="text-[var(--tx3)]">
                    ({new Date(a.created_at).toLocaleString()})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {(mode === "all" || mode === "mine") && (
        <section>
          <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">
            {mode === "mine" ? "Assigned to you" : "All leads"}
          </h2>
          <div className="rounded-xl border border-[var(--brd)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left min-w-[640px]">
                <thead className="bg-[var(--gdim)]/50 text-[var(--tx3)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Contact</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Path</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Created</th>
                    <th className="px-3 py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody className="text-[var(--tx2)]">
                  {list.map((lead) => (
                    <tr key={lead.id} className="border-t border-[var(--brd)]/60 hover:bg-[var(--gdim)]/30">
                      <td className="px-3 py-2 font-mono font-semibold text-[var(--gold)]">{lead.lead_number}</td>
                      <td className="px-3 py-2">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                        <div className="text-[10px] text-[var(--tx3)]">{lead.phone || lead.email || ""}</div>
                      </td>
                      <td className="px-3 py-2">{sourceLabel(lead.source, lead.source_detail)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          {(() => {
                            const p = lead.completeness_path || "manual_review";
                            const { Icon: Ic, className: cl } = pathIcon(p);
                            return (
                              <>
                                <Ic className={`w-3.5 h-3.5 ${cl}`} weight="fill" aria-hidden />
                                <span className="text-[10px]">{COMPLETENESS_PATH_LABELS[p] || p}</span>
                              </>
                            );
                          })()}
                        </span>
                      </td>
                      <td className="px-3 py-2">{LEAD_STATUS_LABELS[lead.status] || lead.status}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--tx3)]">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/leads/${lead.id}`} className="text-[var(--gold)] font-semibold hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {manualOpen && (
        <ModalDialogFrame
          zClassName="z-50"
          backdropClassName="bg-black/50"
          onBackdropClick={() => setManualOpen(false)}
          panelClassName="bg-[var(--card)] border border-[var(--brd)] rounded-xl max-w-lg w-full shadow-xl max-h-[min(520px,85dvh)] flex flex-col overflow-hidden my-auto modal-card"
          ariaLabelledBy="manual-lead-title"
        >
            <div className="shrink-0 px-5 pt-5 pb-3 border-b border-[var(--brd)]/60">
              <h2 id="manual-lead-title" className="text-[14px] font-bold text-[var(--tx)]">
                Add lead manually
              </h2>
              <p className="text-[11px] text-[var(--tx3)] mt-2 leading-relaxed">
                Paste the full email or notes. We will extract contact details; you can correct them before saving.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 text-[12px]">
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Source</span>
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
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Platform (optional)</span>
                <input
                  value={mPlatform}
                  onChange={(e) => setMPlatform(e.target.value)}
                  placeholder="MoveBuddy, realtor name…"
                  className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Reference ID (optional)</span>
                <input
                  value={mRef}
                  onChange={(e) => setMRef(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">First name</span>
                  <input
                    value={mFirst}
                    onChange={(e) => setMFirst(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Last name</span>
                  <input
                    value={mLast}
                    onChange={(e) => setMLast(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Email</span>
                <input
                  type="email"
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Phone</span>
                <input
                  value={mPhone}
                  onChange={(e) => setMPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Paste inquiry</span>
                <textarea
                  value={mPaste}
                  onChange={(e) => setMPaste(e.target.value)}
                  rows={4}
                  placeholder="Paste email or notes…"
                  className="mt-1 w-full min-h-[4.5rem] max-h-32 resize-y rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)] font-mono text-[11px]"
                />
              </label>
            </div>
            <div className="shrink-0 flex gap-2 justify-end px-5 py-4 border-t border-[var(--brd)] bg-[var(--card)]">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--tx2)] hover:bg-[var(--gdim)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manualBusy}
                onClick={() => void submitManualLead()}
                className="px-3 py-1.5 rounded-lg bg-[var(--gold)] text-white text-[12px] font-bold disabled:opacity-50"
              >
                {manualBusy ? "Creating…" : "Create lead"}
              </button>
            </div>
        </ModalDialogFrame>
      )}
    </div>
  );
}
