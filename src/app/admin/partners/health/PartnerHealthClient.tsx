"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/AppIcons";
import { PageHeader } from "@/design-system/admin/layout";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { Button } from "@/design-system/admin/primitives";
import BackButton from "../../components/BackButton";
import type { PartnerHealthRow } from "@/app/api/admin/partners/health/route";
import { organizationTypeLabel } from "@/lib/partner-type";

const TYPE_CHIP_CLASSES: Record<string, string> = {
  retail: "text-sky-700 dark:text-sky-300",
  designer: "text-violet-700 dark:text-violet-300",
  gallery: "text-[var(--yu3-wine)]",
  furniture_retailer: "text-blue-700 dark:text-blue-300",
  interior_designer: "text-violet-600 dark:text-violet-200",
  cabinetry: "text-amber-800 dark:text-amber-200",
  flooring: "text-teal-700 dark:text-teal-300",
  art_gallery: "text-[var(--yu3-wine)]",
  antique_dealer: "text-rose-700 dark:text-rose-300",
  hospitality: "text-amber-700 dark:text-amber-200",
  medical_equipment: "text-sky-600 dark:text-sky-200",
  av_technology: "text-indigo-600 dark:text-indigo-200",
  appliances: "text-slate-600 dark:text-slate-300",
  realtor: "text-[var(--yu3-success)]",
  property_manager: "text-emerald-700 dark:text-emerald-300",
  developer: "text-violet-700 dark:text-violet-200",
  property_management_residential: "text-[var(--yu3-wine)]",
  property_management_commercial: "text-[var(--yu3-wine)]",
  developer_builder: "text-violet-700 dark:text-violet-200",
};

function typeChipCls(type: string): string {
  return TYPE_CHIP_CLASSES[type] || "text-[var(--yu3-wine)]";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotCls: string; badgeCls: string }
> = {
  active: {
    label: "Active",
    dotCls: "bg-[var(--yu3-success)]",
    badgeCls: "text-[var(--yu3-success)]",
  },
  at_risk: {
    label: "At risk",
    dotCls: "bg-amber-500",
    badgeCls: "text-amber-800 dark:text-amber-200",
  },
  cold: {
    label: "Cold",
    dotCls: "bg-sky-500",
    badgeCls: "text-sky-800 dark:text-sky-200",
  },
  churned: {
    label: "Churned",
    dotCls: "bg-[var(--yu3-ink-muted)]",
    badgeCls: "text-[var(--yu3-ink-muted)]",
  },
};

const TREND_CONFIG: Record<
  string,
  { label: string; iconName: string; cls: string }
> = {
  increasing: {
    label: "Increasing",
    iconName: "trendingUp",
    cls: "text-[var(--yu3-success)]",
  },
  stable: {
    label: "Stable",
    iconName: "minus",
    cls: "text-[var(--yu3-ink-muted)]",
  },
  declining: {
    label: "Declining",
    iconName: "trendingDown",
    cls: "text-[var(--yu3-wine)]",
  },
};

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

function fmtLastDelivery(days: number | null): string {
  if (days === null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface ReEngageModalProps {
  partner: PartnerHealthRow;
  onClose: () => void;
}

function ReEngageModal({ partner, onClose }: ReEngageModalProps) {
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const firstName = partner.contact_name?.split(" ")[0] || partner.name;

  const subject = `Checking in, ${partner.name} × Yugo`;
  const body = `Hi ${firstName},

It's been a few weeks since your last delivery with us. Just checking in to see if you have any upcoming needs.

We're here whenever you need us, just reach out!

Best,
The Yugo Team`;

  const handleSendEmail = () => {
    window.open(
      `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const handleSendSms = async () => {
    if (!partner.phone) return;
    setSmsSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: partner.phone,
          message: `Hi ${firstName}, just checking in from Yugo! It's been a while since your last delivery. Do you have any upcoming needs we can help with? We're here anytime., Yugo Team`,
          type: "partner_reengagement",
          related_id: partner.id,
          related_type: "organization",
          recipient_name: partner.contact_name || partner.name,
        }),
      });
      if (res.ok) setSmsSent(true);
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reengage-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="reengage-title"
            className="font-heading text-[16px] font-bold text-[var(--yu3-ink-strong)]"
          >
            Re-engage {partner.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--yu3-ink-muted)] transition-colors hover:text-[var(--yu3-ink)]"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-1 yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Subject</p>
          <p className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)] px-3 py-2 text-[12px] text-[var(--yu3-ink)]">
            {subject}
          </p>
        </div>

        <div className="mb-5">
          <p className="mb-1 yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Message</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)] px-3 py-2 font-sans text-[12px] leading-relaxed text-[var(--yu3-ink)]">
            {body}
          </pre>
        </div>

        {smsSent && (
          <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-[var(--yu3-success)]">
            <Icon name="check" className="h-4 w-4" />
            SMS sent
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={handleSendEmail}
            disabled={!partner.email}
            leadingIcon={<Icon name="mail" className="h-3.5 w-3.5" aria-hidden />}
          >
            Send via email
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleSendSms}
            disabled={smsSending || smsSent || !partner.phone}
            leadingIcon={<Icon name="messageSquare" className="h-3.5 w-3.5" aria-hidden />}
          >
            {smsSending ? "Sending…" : "Send via SMS"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type FilterStatus = "all" | "active" | "at_risk" | "cold" | "churned";

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: "All",
  active: "Active",
  at_risk: "At risk",
  cold: "Cold",
  churned: "Churned",
};

const TABLE_SECTION_LABEL: Record<FilterStatus, string> = {
  all: "All partners",
  active: "Active partners",
  at_risk: "At risk partners",
  cold: "Cold partners",
  churned: "Churned partners",
};

const pillActionCls =
  "inline-flex h-8 items-center justify-center rounded-full border border-[var(--yu3-line)] px-3.5 text-[10px] font-semibold text-[var(--yu3-ink-muted)] transition-colors hover:border-[var(--yu3-line-strong)] hover:text-[var(--yu3-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]";

export default function PartnerHealthClient() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerHealthRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, at_risk: 0, cold: 0, churned: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [reEngagePartner, setReEngagePartner] = useState<PartnerHealthRow | null>(null);

  useEffect(() => {
    fetch("/api/admin/partners/health")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setFetchError(d?.error || `Error ${r.status}`);
          return;
        }
        if (Array.isArray(d.partners)) setPartners(d.partners);
        if (d.stats) setStats(d.stats);
      })
      .catch((e) => setFetchError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? partners : partners.filter((p) => p.health_status === filter)),
    [partners, filter],
  );

  const kpiTiles = useMemo(
    () => [
      {
        id: "total",
        label: "Total partners",
        value: String(stats.total),
        hint: "All verticals",
      },
      {
        id: "active",
        label: "Active",
        value: String(stats.active),
        hint: "Delivery in 14d",
        valueClassName: stats.active > 0 ? "text-[var(--yu3-success)]" : undefined,
      },
      {
        id: "at_risk",
        label: "At risk",
        value: String(stats.at_risk),
        hint: "15-30 days",
        valueClassName: stats.at_risk > 0 ? "text-amber-700 dark:text-amber-200" : undefined,
      },
      {
        id: "cold",
        label: "Cold",
        value: String(stats.cold),
        hint: "31-60 days",
        valueClassName: stats.cold > 0 ? "text-sky-800 dark:text-sky-200" : undefined,
      },
      {
        id: "churned",
        label: "Churned",
        value: String(stats.churned),
        hint: "60+ days silent",
        valueClassName: stats.churned > 0 ? "text-[var(--yu3-ink-muted)]" : undefined,
      },
    ],
    [stats],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--yu3-wine)] border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="w-full min-w-0 py-10">
        <div className="flex items-start gap-3 rounded-[var(--yu3-r-lg)] border border-red-500/20 bg-red-500/10 px-4 py-3">
          <Icon name="alertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">
              Failed to load partner health
            </p>
            <p className="mt-0.5 text-[11px] text-red-600/80 dark:text-red-400/70">{fetchError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 animate-fade-up flex flex-col gap-6 py-1">
      {reEngagePartner && (
        <ReEngageModal partner={reEngagePartner} onClose={() => setReEngagePartner(null)} />
      )}

      <div>
        <BackButton
          label="Partners"
          href="/admin/partners"
          variant="v2"
          className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
        />
      </div>

      <PageHeader eyebrow="Partners" title="Partner Health" />

      <KpiStrip tiles={kpiTiles} columns={5} variant="grid" className="gap-3" />

      {stats.at_risk + stats.cold > 0 && (
        <div
          className="flex items-center gap-3 rounded-[var(--yu3-r-lg)] border border-amber-500/25 bg-amber-500/10 px-4 py-3"
          role="status"
        >
          <Icon name="alertTriangle" className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-[12px] text-amber-900 dark:text-amber-200">
            <span className="font-semibold">
              {stats.at_risk + stats.cold} partner{stats.at_risk + stats.cold !== 1 ? "s" : ""}
            </span>{" "}
            have not booked in 15+ days. Consider reaching out.
          </p>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--yu3-line)] pb-4">
          {(["all", "active", "at_risk", "cold", "churned"] as FilterStatus[]).map((key) => {
            const cfg = key !== "all" ? STATUS_CONFIG[key] : null;
            const count = key === "all" ? stats.total : (stats[key as keyof typeof stats] as number);
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  isActive
                    ? "inline-flex items-center gap-1.5 rounded-full border border-[var(--yu3-wine)] bg-[var(--yu3-wine)] px-3.5 py-2 text-[11px] font-semibold text-[var(--yu3-on-wine)] transition-colors"
                    : "inline-flex items-center gap-1.5 rounded-full border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-3.5 py-2 text-[11px] font-semibold text-[var(--yu3-ink-muted)] transition-colors hover:border-[var(--yu3-line-strong)] hover:text-[var(--yu3-ink)]"
                }
              >
                {cfg && !isActive && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />}
                {FILTER_LABELS[key]}
                <span className={isActive ? "opacity-80" : "opacity-50"}>{count}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 yu3-t-eyebrow text-[var(--yu3-ink-muted)]">{TABLE_SECTION_LABEL[filter]}</p>
      </div>

      <div className="overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)]/50">
                {["Partner", "Status", "Volume (30d)", "Trend", "Revenue", "Last delivery", "Action"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left yu3-t-eyebrow text-[var(--yu3-ink-muted)]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--yu3-line-subtle)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[var(--yu3-ink-muted)]">
                    No partners in this category
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const statusCfg = STATUS_CONFIG[p.health_status] ?? STATUS_CONFIG.churned!;
                const trendCfg = TREND_CONFIG[p.trend] ?? TREND_CONFIG.stable!;
                const canReEngage = p.health_status === "at_risk" || p.health_status === "cold";
                const isChurned = p.health_status === "churned";

                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-[var(--yu3-bg-surface-sunken)]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)]">{p.name}</div>
                      <span
                        className={`mt-1 inline-flex items-center yu3-t-eyebrow whitespace-nowrap ${typeChipCls(p.type)}`}
                      >
                        {p.type === "b2b" ? "Other partner" : organizationTypeLabel(p.type)}
                      </span>
                      {p.contact_name && (
                        <div className="mt-0.5 text-[11px] text-[var(--yu3-ink-muted)]">
                          {p.contact_name}
                        </div>
                      )}
                      {p.revenue_by_vertical_90d && p.revenue_by_vertical_90d.length > 0 ? (
                        <div className="mt-2 max-w-[220px] text-[10px] leading-snug text-[var(--yu3-ink-muted)]">
                          <span className="font-bold uppercase tracking-wide text-[var(--yu3-ink)]">
                            Revenue by vertical (90d)
                          </span>
                          <ul className="mt-1 space-y-0.5">
                            {p.revenue_by_vertical_90d.slice(0, 4).map((row) => (
                              <li key={row.code || row.label}>
                                {row.label}: {fmtCurrency(row.revenue)}
                                {row.pct > 0 ? ` (${row.pct}%)` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`flex w-fit items-center gap-1.5 yu3-t-eyebrow ${statusCfg.badgeCls}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotCls}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="yu3-num text-[13px] font-bold text-[var(--yu3-ink-strong)]">
                        {p.volume_30d}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-[12px] font-medium ${trendCfg.cls}`}>
                        <Icon name={trendCfg.iconName} className="h-3.5 w-3.5 shrink-0" />
                        {trendCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[var(--yu3-ink-strong)]">
                        {p.revenue_30d > 0 ? fmtCurrency(p.revenue_30d) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[var(--yu3-ink-muted)]">
                        {fmtLastDelivery(p.days_since_last)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isChurned ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/clients/${p.id}`)}
                          className={pillActionCls}
                        >
                          Archive
                        </button>
                      ) : canReEngage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-200"
                          onClick={() => setReEngagePartner(p)}
                        >
                          Re-engage
                        </Button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/clients/${p.id}`)}
                            className={pillActionCls}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/partners/${p.id}/billing`)}
                            className={pillActionCls}
                          >
                            Billing
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
