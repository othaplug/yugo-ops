"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/AppIcons";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import type { PartnerHealthRow } from "@/app/api/admin/partners/health/route";
import { organizationTypeLabel } from "@/lib/partner-type";

const TYPE_CHIP_CLASSES: Record<string, string> = {
  retail: "bg-[rgba(74,124,229,0.14)] text-[#4A7CE5]",
  designer: "bg-[rgba(139,92,246,0.14)] text-[#8B5CF6]",
  gallery: "bg-[rgba(201,169,98,0.16)] text-[var(--gold)]",
  furniture_retailer: "bg-[rgba(59,130,246,0.14)] text-[#3B82F6]",
  interior_designer: "bg-[rgba(167,139,250,0.16)] text-[#A78BFA]",
  cabinetry: "bg-[rgba(180,83,9,0.14)] text-[#B45309]",
  flooring: "bg-[rgba(13,148,136,0.14)] text-[#0D9488]",
  art_gallery: "bg-[rgba(201,169,98,0.16)] text-[var(--gold)]",
  antique_dealer: "bg-[rgba(190,18,60,0.12)] text-[#BE123C]",
  hospitality: "bg-[rgba(212,138,41,0.14)] text-[var(--org)]",
  medical_equipment: "bg-[rgba(14,165,233,0.14)] text-[#0EA5E9]",
  av_technology: "bg-[rgba(99,102,241,0.14)] text-[#6366F1]",
  appliances: "bg-[rgba(71,85,105,0.16)] text-[#64748B]",
  realtor: "bg-[rgba(45,159,90,0.14)] text-[var(--grn)]",
  property_manager: "bg-[rgba(22,163,74,0.14)] text-[#16A34A]",
  developer: "bg-[rgba(124,58,237,0.14)] text-[#7C3AED]",
  property_management_residential: "bg-[rgba(201,169,98,0.18)] text-[var(--gold)]",
  property_management_commercial: "bg-[rgba(201,169,98,0.18)] text-[var(--gold)]",
  developer_builder: "bg-[rgba(124,58,237,0.14)] text-[#7C3AED]",
};

function typeChipCls(type: string): string {
  return TYPE_CHIP_CLASSES[type] || "bg-[var(--gdim)] text-[var(--gold)]";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotCls: string; badgeCls: string }
> = {
  active: {
    label: "Active",
    dotCls: "bg-[var(--grn)]",
    badgeCls: "bg-[var(--grn)]/10 text-[var(--grn)]",
  },
  at_risk: {
    label: "At risk",
    dotCls: "bg-amber-400",
    badgeCls: "bg-amber-400/10 text-amber-400",
  },
  cold: {
    label: "Cold",
    dotCls: "bg-blue-400",
    badgeCls: "bg-blue-400/10 text-blue-400",
  },
  churned: {
    label: "Churned",
    dotCls: "bg-[var(--tx3)]",
    badgeCls: "bg-[var(--tx3)]/10 text-[var(--tx3)]",
  },
};

const TREND_CONFIG: Record<string, { label: string; iconName: string; cls: string }> = {
  increasing: { label: "Increasing", iconName: "trendingUp", cls: "text-[var(--grn)]" },
  stable: { label: "Stable", iconName: "minus", cls: "text-[var(--tx3)]" },
  declining: { label: "Declining", iconName: "trendingDown", cls: "text-red-400" },
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
  const body = `Hi ${firstName},\n\nIt's been a few weeks since your last delivery with us. Just checking in to see if you have any upcoming needs.\n\nWe're here whenever you need us, just reach out!\n\nBest,\nThe Yugo Team`;

  const handleSendEmail = () => {
    window.open(
      `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-[16px] font-bold text-[var(--tx)]">
            Re-engage {partner.name}
          </h3>
          <button onClick={onClose} className="text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Subject</p>
          <p className="text-[12px] text-[var(--tx)] bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--brd)]">
            {subject}
          </p>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Message</p>
          <pre className="text-[12px] text-[var(--tx)] bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--brd)] whitespace-pre-wrap font-sans leading-relaxed">
            {body}
          </pre>
        </div>

        {smsSent && (
          <div className="mb-3 flex items-center gap-2 text-[var(--grn)] text-[12px] font-medium">
            <Icon name="check" className="w-4 h-4" />
            SMS sent
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={!partner.email}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all disabled:opacity-40"
          >
            <Icon name="mail" className="w-3.5 h-3.5" />
            Send via email
          </button>
          <button
            type="button"
            onClick={handleSendSms}
            disabled={smsSending || smsSent || !partner.phone}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-40"
          >
            <Icon name="messageSquare" className="w-3.5 h-3.5" />
            {smsSending ? "Sending…" : "Send via SMS"}
          </button>
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
    [partners, filter]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <Icon name="alertTriangle" className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-400">Failed to load partner health</p>
            <p className="text-[11px] text-red-400/70 mt-0.5">{fetchError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      {reEngagePartner && (
        <ReEngageModal partner={reEngagePartner} onClose={() => setReEngagePartner(null)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">
            Partners
          </p>
          <h1 className="admin-page-hero text-[var(--tx)]">
            Partner Health
          </h1>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-2">
        <KpiCard label="Total partners" value={String(stats.total)} sub="all verticals" />
        <KpiCard label="Active" value={String(stats.active)} sub="delivery in 14d" accent={stats.active > 0} />
        <KpiCard label="At risk" value={String(stats.at_risk)} sub="15–30 days" warn={stats.at_risk > 0} />
        <KpiCard label="Cold" value={String(stats.cold)} sub="31–60 days" warn={stats.cold > 0} />
        <KpiCard label="Churned" value={String(stats.churned)} sub="60+ days silent" />
      </div>

      {/* At-risk alert */}
      {(stats.at_risk + stats.cold) > 0 && (
        <div className="flex items-center gap-3 my-4 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
          <Icon name="alertTriangle" className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[12px] text-amber-300">
            <span className="font-semibold">
              {stats.at_risk + stats.cold} partner{(stats.at_risk + stats.cold) !== 1 ? "s" : ""}
            </span>{" "}
            haven't booked in 15+ days. Consider reaching out.
          </p>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap my-5">
        {(["all", "active", "at_risk", "cold", "churned"] as FilterStatus[]).map((key) => {
          const cfg = key !== "all" ? STATUS_CONFIG[key] : null;
          const count = key === "all" ? stats.total : stats[key as keyof typeof stats] as number;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                filter === key
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--tx)]"
              }`}
            >
              {cfg && filter !== key && (
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
              )}
              {FILTER_LABELS[key]}
              <span className={`text-[10px] ${filter === key ? "opacity-70" : "opacity-50"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <SectionDivider label={`${FILTER_LABELS[filter]} partners`} />

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                {["Partner", "Status", "Volume (30d)", "Trend", "Revenue", "Last delivery", "Action"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[var(--tx3)]">
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
                  <tr key={p.id} className="hover:bg-[var(--bg)]/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{p.name}</div>
                      <span className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${typeChipCls(p.type)}`}>
                        {p.type === "b2b" ? "Other partner" : organizationTypeLabel(p.type)}
                      </span>
                      {p.contact_name && (
                        <div className="mt-0.5 text-[11px] text-[var(--tx3)]">{p.contact_name}</div>
                      )}
                      {p.revenue_by_vertical_90d && p.revenue_by_vertical_90d.length > 0 ? (
                        <div className="mt-2 text-[10px] text-[var(--tx3)] leading-snug max-w-[220px]">
                          <span className="font-bold text-[var(--tx2)] uppercase tracking-wide">Revenue by vertical (90d)</span>
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
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 w-fit ${statusCfg.badgeCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-bold text-[var(--tx)]">{p.volume_30d}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-[12px] font-medium ${trendCfg.cls}`}>
                        <Icon name={trendCfg.iconName} className="w-3.5 h-3.5" />
                        {trendCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[var(--tx)]">
                        {p.revenue_30d > 0 ? fmtCurrency(p.revenue_30d) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[var(--tx3)]">
                        {fmtLastDelivery(p.days_since_last)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isChurned ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/clients/${p.id}`)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-red-400 hover:text-red-400 transition-all"
                        >
                          Archive
                        </button>
                      ) : canReEngage ? (
                        <button
                          type="button"
                          onClick={() => setReEngagePartner(p)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-all"
                        >
                          Re-engage
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/clients/${p.id}`)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/partners/${p.id}/billing`)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
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
