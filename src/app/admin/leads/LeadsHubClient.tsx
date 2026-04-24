"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  COMPLETENESS_PATH_LABELS,
  DETECTED_SERVICE_TYPE_LABELS,
  LEAD_ACTIVITY_LABELS,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/admin-labels";
import LeadResponseSlaCountdown from "./LeadResponseSlaCountdown";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import {
  CaretRight,
  ChartBar,
  CheckCircle,
  Lightning,
  List,
  Phone,
  Plus,
  User,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { SpeedToLeadHint } from "@/components/admin/AdminContextHints";

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
  detected_service_type?: string | null;
  move_size: string | null;
  preferred_date: string | null;
  from_address: string | null;
  to_address: string | null;
  status: string;
  priority: string;
  created_at: string;
  first_response_at: string | null;
  response_sla_target_at?: string | null;
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
  requires_specialty_quote?: boolean | null;
  parsed_weight_lbs_max?: number | null;
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
  bySource: Record<
    string,
    { count: number; converted: number; valueSum: number }
  >;
  speedVsConversion: {
    label: string;
    leads: number;
    converted: number;
    rate: number;
  }[];
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
  const sec = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 1000),
  );
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
  const label =
    m >= 60
      ? `${Math.floor(m / 60)}h ${m % 60}m`
      : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span
      className={`tabular-nums font-mono text-[13px] font-bold ${color}`}
      title="Time since lead arrived"
    >
      {label}
    </span>
  );
}

function pathIcon(path: string | null | undefined) {
  const p = path || "manual_review";
  if (p === "auto_quote")
    return { Icon: CheckCircle, className: "text-emerald-500" };
  if (p === "needs_info")
    return { Icon: WarningCircle, className: "text-amber-400" };
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

export default function LeadsHubClient({
  mode,
}: {
  mode: "dashboard" | "all" | "mine";
}) {
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
        mode === "dashboard"
          ? fetch("/api/admin/leads/metrics")
          : Promise.resolve(null as Response | null),
        mode === "dashboard"
          ? fetch("/api/admin/leads?attention=1&limit=50")
          : Promise.resolve(null as Response | null),
        mode !== "dashboard"
          ? fetch(
              mode === "mine"
                ? "/api/admin/leads?mine=1&limit=300"
                : "/api/admin/leads?limit=300",
            )
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        () => {
          refresh();
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        () => {
          refresh();
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, router]);

  const todayRow = useMemo(() => {
    if (!metrics?.todayByStatus)
      return { new: 0, contacted: 0, quote_sent: 0, converted: 0, lost: 0 };
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

  const subNavLinkClass = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
      active
        ? "bg-[var(--tx)] text-[var(--bg2)] dark:bg-[var(--tx2)] dark:text-[var(--bg)]"
        : "bg-transparent text-[var(--tx2)] shadow-[inset_0_0_0_1px_var(--brd)] hover:bg-[var(--hover)]"
    }`;

  const subNav = (
    <nav className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="Leads views">
      <Link
        href="/admin/leads"
        className={subNavLinkClass(mode === "dashboard")}
      >
        <ChartBar size={14} aria-hidden className="opacity-80" />
        Dashboard
      </Link>
      <Link href="/admin/leads/all" className={subNavLinkClass(mode === "all")}>
        <List size={14} aria-hidden className="opacity-80" />
        All leads
      </Link>
      <Link
        href="/admin/leads/mine"
        className={subNavLinkClass(mode === "mine")}
      >
        <User size={14} aria-hidden className="opacity-80" />
        My leads
      </Link>
    </nav>
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
    const name =
      [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
    const tel = telHref(lead.phone);
    const sms = smsHref(lead.phone);
    const quoteHref = `/admin/quotes/new?lead_id=${encodeURIComponent(lead.id)}`;
    const specialtyQuoteHref = `${quoteHref}&specialty_builder=1`;
    const path = lead.completeness_path || "manual_review";
    const heavyParsed =
      lead.parsed_weight_lbs_max != null &&
      Number(lead.parsed_weight_lbs_max) > 300;
    const { Icon: PathIc, className: pathCls } = pathIcon(path);
    const invN = parsedInvCount(lead);
    const missing = Array.isArray(lead.fields_missing)
      ? (lead.fields_missing as string[]).slice(0, 3)
      : [];
    const clar = Array.isArray(lead.clarifications_needed)
      ? (lead.clarifications_needed as string[]).slice(0, 2)
      : [];

    return (
      <article className="flex flex-col gap-3 rounded-2xl bg-[var(--card)] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[var(--brd)]/40 dark:shadow-none dark:ring-[var(--brd)]/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="shrink-0"
                title={COMPLETENESS_PATH_LABELS[path] || path}
              >
                <PathIc
                  className={`h-4 w-4 ${pathCls}`}
                  weight="fill"
                  aria-hidden
                />
              </span>
              <LeadElapsedTimer createdAt={lead.created_at} />
              <span className="text-[var(--tx3)]" aria-hidden>
                |
              </span>
              <LeadResponseSlaCountdown
                createdAt={lead.created_at}
                responseSlaTargetAt={lead.response_sla_target_at}
                firstResponseAt={lead.first_response_at}
              />
              <span className="truncate text-[13px] font-bold text-[var(--tx)]">
                {lead.lead_number} — {name}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-[var(--tx2)] mt-1">
              {COMPLETENESS_PATH_LABELS[path] || path}
              {lead.status === "follow_up_sent" ? " · Follow-up sent" : ""}
            </p>
            <p className="text-[11px] text-[var(--tx3)] mt-1">
              {[lead.phone, lead.move_size, lead.preferred_date].filter(Boolean).join(" | ")}
            </p>
            {lead.intelligence_summary ? (
              <p className="text-[10px] text-[var(--tx2)] mt-1 line-clamp-2">
                {lead.intelligence_summary}
              </p>
            ) : null}
            {invN != null && invN > 0 ? (
              <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                {invN} inventory line(s) parsed
              </p>
            ) : null}
            {lead.recommended_tier ? (
              <p className="text-[10px] text-amber-400/90 mt-0.5">
                Recommend: {String(lead.recommended_tier).toUpperCase()}
              </p>
            ) : null}
            {missing.length > 0 ? (
              <p className="text-[10px] text-orange-400/90 mt-0.5">
                Missing: {missing.join(", ")}
              </p>
            ) : null}
            {clar.length > 0 ? (
              <p className="text-[10px] text-[var(--tx3)] mt-0.5 line-clamp-2">
                {clar.join(" · ")}
              </p>
            ) : null}
            {lead.follow_up_sent_at ? (
              <p className="text-[10px] text-amber-400/80 mt-0.5">
                Client follow-up sent{" "}
                {new Date(lead.follow_up_sent_at).toLocaleString()}
              </p>
            ) : null}
            <p className="text-[11px] text-[var(--tx2)] mt-0.5">
              Source: {sourceLabel(lead.source, lead.source_detail)}
              {lead.source === "google_ads" && (
                <span className="ml-1 text-amber-400 font-semibold">Paid</span>
              )}
              {lead.source === "phone_call" &&
                (lead.source_detail || "").toLowerCase().includes("miss") && (
                  <span className="ml-1 text-red-400 font-semibold">
                    Call back
                  </span>
                )}
            </p>
            {lead.priority === "urgent" || lead.priority === "high" ? (
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-orange-400">
                {LEAD_PRIORITY_LABELS[lead.priority] || lead.priority}
              </span>
            ) : null}
            {lead.requires_specialty_quote || heavyParsed ? (
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--org)] border border-[var(--org)]/35 rounded px-1.5 py-0.5">
                Specialty quote
              </span>
            ) : null}
            {(lead.service_type === "pm_inquiry" ||
              lead.detected_service_type === "pm_inquiry") && (
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide bg-amber-400/15 text-amber-600 border border-amber-400/25 rounded px-1.5 py-0.5">
                {DETECTED_SERVICE_TYPE_LABELS.pm_inquiry}
              </span>
            )}
          </div>
          <Link
            href={`/admin/leads/${lead.id}`}
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx)] underline-offset-2 hover:underline dark:text-[var(--tx2)]"
          >
            Details
            <CaretRight
              size={12}
              weight="bold"
              className="opacity-70"
              aria-hidden
            />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[var(--brd)]/35 pt-3">
          <Link
            href={quoteHref}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--tx)]/25 text-[11px] font-semibold text-[var(--tx)] tracking-wide uppercase hover:bg-[var(--hover)]"
          >
            Send quote
            <CaretRight
              size={14}
              weight="bold"
              className="opacity-80"
              aria-hidden
            />
          </Link>
          {(lead.requires_specialty_quote || heavyParsed) && (
            <Link
              href={specialtyQuoteHref}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
            >
              Specialty builder
              <CaretRight
                size={14}
                weight="bold"
                className="opacity-70"
                aria-hidden
              />
            </Link>
          )}
          {tel ? (
            <a
              href={tel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
            >
              <Phone size={14} aria-hidden />
              Call
            </a>
          ) : null}
          {sms ? (
            <a
              href={sms}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
            >
              SMS
            </a>
          ) : null}
        </div>
      </article>
    );
  }

  const sectionTitle =
    "mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/65";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-8 space-y-2 sm:mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]/55">
          Revenue
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="admin-page-hero text-[var(--tx)] mb-0">Leads</h1>
          <SpeedToLeadHint ariaLabel="Speed to lead" />
        </div>
      </header>

      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {subNav}
        {(mode === "dashboard" || mode === "all") && (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#2C3E2D]/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] transition-colors hover:bg-[#2C3E2D]/[0.06] dark:border-[var(--brd)] dark:text-[var(--tx2)] dark:hover:bg-[var(--hover)] sm:self-auto"
          >
            <Plus size={14} weight="bold" aria-hidden />
            Add lead manually
            <CaretRight
              size={14}
              weight="bold"
              aria-hidden
              className="opacity-80"
            />
          </button>
        )}
      </div>

      {loadErr && (
        <p
          className="mb-6 rounded-xl bg-[var(--red)]/10 px-4 py-3 text-[13px] text-[var(--red)] ring-1 ring-[var(--red)]/20"
          role="alert"
        >
          {loadErr}
        </p>
      )}

      {mode === "dashboard" && metrics && (
        <div className="space-y-10 sm:space-y-12">
          <section aria-label="Speed to lead today">
            <h2 className={`${sectionTitle} flex-wrap`}>
              <Lightning size={14} className="text-[var(--tx2)]" aria-hidden />
              <span className="flex items-center gap-1.5 flex-wrap">
                Speed to lead — today
                <SpeedToLeadHint iconSize={14} ariaLabel="Speed to lead" />
              </span>
            </h2>
            <div className="overflow-hidden rounded-2xl bg-[var(--brd)]/[0.28] p-px shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-[var(--brd)]/35 dark:shadow-none">
              <div className="grid grid-cols-2 gap-px sm:grid-cols-5">
                {[
                  { k: "new", label: "Attention" },
                  { k: "contacted", label: "Contacted" },
                  { k: "quote_sent", label: "Quote sent" },
                  { k: "converted", label: "Converted" },
                  { k: "lost", label: "Lost" },
                ].map(({ k, label }) => (
                  <div
                    key={k}
                    className="bg-[var(--card)] px-3 py-4 text-center sm:px-4 sm:py-5"
                  >
                    <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight text-[var(--tx)]">
                      {todayRow[k as keyof typeof todayRow]}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]/65">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--brd)]/35 bg-[var(--card)] px-4 py-3.5 sm:px-5">
                <span className="text-[13px] text-[var(--tx2)]">
                  Avg response time (this month)
                </span>
                <span className="text-[15px] font-semibold tabular-nums text-[var(--tx)]">
                  {metrics.avgResponseMin != null
                    ? `${metrics.avgResponseMin} min`
                    : "0 min"}
                </span>
                <span className="text-[11px] text-[var(--tx3)]/80">
                  Target under 5 min
                </span>
              </div>
            </div>
          </section>

          <section aria-label="Leads needing attention">
            <h2 className={`${sectionTitle} mb-1`}>Needs attention</h2>
            <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-[var(--tx3)]/85">
              Open leads without a quote (new, assigned, follow-up sent,
              awaiting reply), oldest first. Timers update live.
            </p>
            {attention.length === 0 ? (
              <p className="py-14 text-center text-[15px] text-[var(--tx3)]/85">
                No leads waiting — great job.
              </p>
            ) : (
              <div className="space-y-4">
                {attention.map((lead) => (
                  <LeadActionCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="This month funnel">
            <h2 className={sectionTitle}>This month — funnel</h2>
            <div className="overflow-hidden rounded-2xl bg-[var(--brd)]/[0.28] p-px shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-[var(--brd)]/35 dark:shadow-none">
              <dl className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["Leads received", metrics.funnel.received],
                    ["Contacted", metrics.funnel.contacted],
                    ["Quote sent", metrics.funnel.quote_sent],
                    ["Converted", metrics.funnel.converted],
                    ["Lost", metrics.funnel.lost],
                    ["Stale", metrics.funnel.stale],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 bg-[var(--card)] px-4 py-3.5 sm:px-5"
                  >
                    <dt className="text-[13px] text-[var(--tx2)]">{label}</dt>
                    <dd className="font-heading text-lg font-semibold tabular-nums text-[var(--tx)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section aria-label="Response quality">
            <h2 className={sectionTitle}>Response quality</h2>
            <div className="overflow-hidden rounded-2xl bg-[var(--brd)]/[0.28] p-px shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-[var(--brd)]/35 dark:shadow-none">
              <div className="grid gap-px md:grid-cols-2">
                <div className="bg-[var(--card)] p-4 sm:p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70">
                    Buckets
                  </p>
                  <ul className="space-y-2.5 text-[13px] text-[var(--tx2)]">
                    <li className="flex justify-between gap-3">
                      <span>Under 5 min</span>
                      <span className="tabular-nums font-medium text-[var(--tx)]">
                        {metrics.pctUnder5min != null
                          ? `${metrics.pctUnder5min}%`
                          : "0%"}
                      </span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span>Under 15 min</span>
                      <span className="tabular-nums font-medium text-[var(--tx)]">
                        {metrics.pctUnder15min != null
                          ? `${metrics.pctUnder15min}%`
                          : "0%"}
                      </span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span>Over 1 hr</span>
                      <span className="tabular-nums font-medium text-[var(--tx)]">
                        {metrics.pctOver1hr != null
                          ? `${metrics.pctOver1hr}%`
                          : "0%"}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="min-w-0 bg-[var(--card)] p-4 sm:p-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70">
                    Speed vs conversion
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px] border-collapse text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--brd)]/50">
                          <th
                            scope="col"
                            className="py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                          >
                            Window
                          </th>
                          <th
                            scope="col"
                            className="py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                          >
                            Leads
                          </th>
                          <th
                            scope="col"
                            className="py-2 pr-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                          >
                            Converted
                          </th>
                          <th
                            scope="col"
                            className="py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                          >
                            Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--tx2)]">
                        {metrics.speedVsConversion.map((row) => (
                          <tr
                            key={row.label}
                            className="border-b border-[var(--brd)]/[0.35] last:border-b-0"
                          >
                            <td className="py-2 pr-3">{row.label}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {row.leads}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {row.converted}
                            </td>
                            <td className="py-2 tabular-nums">{row.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Leads by source">
            <h2 className={sectionTitle}>By source</h2>
            <div className="overflow-x-auto rounded-2xl bg-[var(--card)] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[var(--brd)]/40 dark:shadow-none dark:ring-[var(--brd)]/50">
              <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--brd)]/50">
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                    >
                      Source
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                    >
                      Leads
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                    >
                      Converted
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                    >
                      Rate
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70"
                    >
                      Avg value
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[var(--tx2)]">
                  {Object.entries(metrics.bySource)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([src, v]) => (
                      <tr
                        key={src}
                        className="border-b border-[var(--brd)]/[0.35] transition-colors last:border-b-0 hover:bg-[var(--hover)]/80"
                      >
                        <td className="px-4 py-3">
                          {LEAD_SOURCE_LABELS[src] || src}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{v.count}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {v.converted}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {v.count
                            ? Math.round((v.converted / v.count) * 100)
                            : 0}
                          %
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {v.count
                            ? `$${Math.round(v.valueSum / v.count).toLocaleString()}`
                            : ""}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="Recent lead activity">
            <h2 className={sectionTitle}>Recent activity</h2>
            {(metrics.recentActivity || []).length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[var(--tx3)]/80">
                No recent activity.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--brd)]/40 text-[13px] text-[var(--tx2)]">
                {(metrics.recentActivity || []).slice(0, 12).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-3 first:pt-0"
                  >
                    <Link
                      href={`/admin/leads/${a.lead_id}`}
                      className="font-semibold text-[var(--tx)] underline-offset-2 hover:underline dark:text-[var(--tx2)]"
                    >
                      {a.lead_number || "Lead"}
                    </Link>
                    <span className="text-[var(--tx3)]">·</span>
                    <span>
                      {LEAD_ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                    </span>
                    <span className="text-[12px] text-[var(--tx3)]">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {(mode === "all" || mode === "mine") && (
        <section aria-label={mode === "mine" ? "Your leads" : "All leads"}>
          <h2 className={sectionTitle}>
            {mode === "mine" ? "Assigned to you" : "All leads"}
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-[var(--card)] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[var(--brd)]/40 dark:shadow-none dark:ring-[var(--brd)]/50">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--brd)]/50 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]/70">
                  <th scope="col" className="px-4 py-3.5">
                    #
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Path
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Created
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5">
                    5 min SLA
                  </th>
                  <th scope="col" className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="text-[var(--tx2)]">
                {list.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[var(--brd)]/[0.35] transition-colors last:border-b-0 hover:bg-[var(--hover)]/80"
                  >
                    <td className="px-4 py-3 font-mono text-[0.8125rem] font-semibold text-[var(--tx)]">
                      {lead.lead_number}
                    </td>
                    <td className="px-4 py-3">
                      {[lead.first_name, lead.last_name]
                        .filter(Boolean)
                        .join(" ") || "Unnamed"}
                      <div className="text-[10px] text-[var(--tx3)]">
                        {lead.phone || lead.email || ""}
                      </div>
                      {(lead.service_type === "pm_inquiry" ||
                        lead.detected_service_type === "pm_inquiry") && (
                        <div className="mt-1">
                          <span className="inline-flex rounded border border-amber-400/25 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
                            {DETECTED_SERVICE_TYPE_LABELS.pm_inquiry}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sourceLabel(lead.source, lead.source_detail)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {(() => {
                          const p = lead.completeness_path || "manual_review";
                          const { Icon: Ic, className: cl } = pathIcon(p);
                          return (
                            <>
                              <Ic
                                className={`h-3.5 w-3.5 ${cl}`}
                                weight="fill"
                                aria-hidden
                              />
                              <span className="text-[10px]">
                                {COMPLETENESS_PATH_LABELS[p] || p}
                              </span>
                            </>
                          );
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--tx3)]">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <LeadResponseSlaCountdown
                        compact
                        createdAt={lead.created_at}
                        responseSlaTargetAt={lead.response_sla_target_at}
                        firstResponseAt={lead.first_response_at}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tx)] underline-offset-2 hover:underline dark:text-[var(--tx2)]"
                      >
                        Open
                        <CaretRight
                          size={12}
                          weight="bold"
                          className="opacity-70"
                          aria-hidden
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ModalOverlay
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title=""
        maxWidth="lg"
        noHeader
        noPadding
      >
        <div className="flex flex-col flex-1 min-h-0 max-h-[min(520px,85dvh)]">
          <div className="shrink-0 px-5 py-4 border-b border-[var(--brd)] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="manual-lead-title"
                className="font-heading text-[17px] font-bold text-[var(--tx)]"
              >
                Add lead manually
              </h2>
              <p className="text-[12px] text-[var(--tx3)] mt-2 leading-relaxed">
                Paste the full email or notes. We will extract contact details;
                you can correct them before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)] hover:text-[var(--tx)] transition-colors touch-manipulation shrink-0"
              aria-label="Close"
            >
              <X size={18} weight="regular" aria-hidden />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 text-[12px]">
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
              className="px-3 py-1.5 rounded-lg bg-[var(--tx)] text-[var(--bg)] text-[12px] font-semibold disabled:opacity-50 hover:opacity-90"
            >
              {manualBusy ? "Creating…" : "Create lead"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
