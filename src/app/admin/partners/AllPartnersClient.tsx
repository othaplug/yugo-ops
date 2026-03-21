"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import { Icon } from "@/components/AppIcons";
import InvitePartnerModal from "@/app/admin/platform/InvitePartnerModal";

interface Partner {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

interface RealtorRow {
  id: string;
  agent_name: string;
  email: string | null;
  brokerage: string | null;
  referral_count: number;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  // Legacy types
  retail: "Retail",
  designer: "Designer",
  gallery: "Art Gallery",
  // Canonical verticals
  furniture_retailer: "Furniture Retailer",
  interior_designer: "Interior Designer",
  cabinetry: "Cabinetry",
  flooring: "Flooring",
  art_gallery: "Art Gallery",
  antique_dealer: "Antique Dealer",
  hospitality: "Hospitality",
  medical_equipment: "Medical Equipment",
  av_technology: "AV / Technology",
  appliances: "Appliances",
  realtor: "Realtor",
  property_manager: "Property Manager",
  developer: "Developer",
};

const TYPE_TAB_KEYS = ["all", "retail", "designer", "hospitality", "gallery", "realtor"] as const;

/** Tab labels (realtor tab = referral partners; realtor is the primary channel) */
const PARTNER_TAB_LABELS: Partial<Record<(typeof TYPE_TAB_KEYS)[number], string>> = {
  realtor: "Realtors & referrals",
};

// Maps each tab key → all DB type values that should appear under that tab
const TAB_TYPE_MAP: Record<string, string[]> = {
  retail:       ["retail", "furniture_retailer", "cabinetry", "flooring", "appliances", "antique_dealer"],
  designer:     ["designer", "interior_designer", "av_technology"],
  hospitality:  ["hospitality", "medical_equipment"],
  gallery:      ["gallery", "art_gallery"],
  realtor:      ["realtor", "property_manager", "developer"],
};

function getTypeLabel(type: string): string {
  if (type === "b2b") return "Other partner";
  return TYPE_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "Other");
}

/** Distinct pill styles per partner type (Tailwind) */
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
  b2b: "bg-[rgba(113,113,122,0.18)] text-[var(--tx2)]",
};

function typeChipClass(type: string): string {
  return TYPE_CHIP_CLASSES[type] || "bg-[var(--gdim)] text-[var(--gold)]";
}

function PartnerTypeChip({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex max-w-max items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight !whitespace-nowrap ${typeChipClass(type)}`}
    >
      {getTypeLabel(type || "")}
    </span>
  );
}

const columns: ColumnDef<Partner>[] = [
  {
    id: "name",
    label: "Company",
    accessor: (p) => p.name,
    render: (p) => (
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-[var(--tx)]">{p.name}</div>
        <div className="mt-1">
          <PartnerTypeChip type={p.type || ""} />
        </div>
        {p.contact_name ? (
          <div className="mt-1 text-[11px] text-[var(--tx3)]">{p.contact_name}</div>
        ) : null}
      </div>
    ),
  },
  {
    id: "_partner_type_search",
    label: "Type",
    accessor: (p) => `${p.type ?? ""} ${getTypeLabel(p.type || "")}`.trim(),
    alwaysHidden: true,
    sortable: false,
    render: (p) => <PartnerTypeChip type={p.type || ""} />,
  },
  {
    id: "email",
    label: "Email",
    accessor: (p) => p.email || "",
    render: (p) => <span className="text-[12px] text-[var(--tx2)]">{p.email || "—"}</span>,
  },
  {
    id: "phone",
    label: "Phone",
    accessor: (p) => p.phone || "",
    render: (p) => <span className="text-[12px] text-[var(--tx2)]">{p.phone || "—"}</span>,
  },
  {
    id: "status",
    label: "Status",
    accessor: (p) => p.status || "active",
    render: (p) => {
      const active = (p.status || "active") === "active";
      return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${active ? "bg-[var(--grn)]/10 text-[var(--grn)]" : "bg-[var(--tx3)]/10 text-[var(--tx3)]"}`}>
          {active ? "Active" : ({ inactive: "Inactive", suspended: "Suspended", pending_approval: "Pending", pending: "Pending" }[p.status || ""] ?? (p.status ? p.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Inactive"))}
        </span>
      );
    },
  },
  {
    id: "created_at",
    label: "Joined",
    accessor: (p) => p.created_at,
    render: (p) => (
      <span className="text-[11px] text-[var(--tx3)]">
        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
      </span>
    ),
  },
];

const realtorColumns: ColumnDef<RealtorRow>[] = [
  {
    id: "agent",
    label: "Agent",
    accessor: (r) => r.agent_name,
    render: (r) => (
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-[var(--tx)]">{r.agent_name}</div>
        {r.brokerage ? <div className="text-[11px] text-[var(--tx3)] mt-0.5">{r.brokerage}</div> : null}
      </div>
    ),
  },
  {
    id: "email",
    label: "Email",
    accessor: (r) => r.email || "",
    render: (r) => <span className="text-[12px] text-[var(--tx2)]">{r.email || "—"}</span>,
  },
  {
    id: "referrals",
    label: "Referrals",
    accessor: (r) => String(r.referral_count),
    render: (r) => <span className="text-[12px] font-semibold text-[var(--tx)]">{r.referral_count}</span>,
  },
  {
    id: "joined",
    label: "Added",
    accessor: (r) => r.created_at,
    render: (r) => (
      <span className="text-[11px] text-[var(--tx3)]">
        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
      </span>
    ),
  },
];

export default function AllPartnersClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [realtors, setRealtors] = useState<RealtorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [healthStats, setHealthStats] = useState<{ at_risk: number; cold: number } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/partners/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setHealthStats({ at_risk: d.stats.at_risk, cold: d.stats.cold });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setFetchError(null);
      try {
        const [pRes, rRes] = await Promise.all([
          fetch("/api/admin/partners/list"),
          fetch("/api/admin/realtors-list"),
        ]);
        const pJson = await pRes.json();
        const rJson = await rRes.json();
        if (!pRes.ok) {
          setFetchError(pJson?.error || pRes.statusText || "Failed to load partners");
          setPartners([]);
        } else {
          setPartners(Array.isArray(pJson.partners) ? pJson.partners : []);
        }
        if (rRes.ok && Array.isArray(rJson.realtors)) {
          setRealtors(rJson.realtors);
        } else {
          setRealtors([]);
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to load partners");
        setPartners([]);
        setRealtors([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === "all") return partners;
    const types = TAB_TYPE_MAP[activeTab];
    return types ? partners.filter((p) => types.includes(p.type)) : partners.filter((p) => p.type === activeTab);
  }, [partners, activeTab]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: partners.length };
    for (const key of TYPE_TAB_KEYS) {
      if (key !== "all") {
        if (key === "realtor") {
          counts[key] = realtors.length;
        } else {
          const types = TAB_TYPE_MAP[key];
          counts[key] = types ? partners.filter((p) => types.includes(p.type)).length : 0;
        }
      }
    }
    return counts;
  }, [partners, realtors]);

  const typeTabs = useMemo(() => {
    const allTab = { key: "all", label: "All Partners" };
    const typeTabsList = TYPE_TAB_KEYS.filter((k) => k !== "all").map((key) => ({
      key,
      label: PARTNER_TAB_LABELS[key] ?? getTypeLabel(key),
    }));
    return [allTab, ...typeTabsList];
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCount = partners.filter((p) => (p.status || "active") === "active").length;
  const recentCount = partners.filter((p) => {
    const d = new Date(p.created_at);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    return d > cutoff;
  }).length;

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">CRM</p>
          <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">B2B Partners</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/partners/health"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            <Icon name="activity" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Partner Health</span>
          </Link>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-[var(--btn-text-on-accent)] transition-all active:scale-95
              bg-[var(--gold)]
              shadow-[0_1px_0_rgba(0,0,0,0.1),0_2px_8px_rgba(201,169,98,0.22),inset_0_1px_0_rgba(255,255,255,0.12)]
              hover:shadow-[0_1px_0_rgba(0,0,0,0.12),0_3px_12px_rgba(201,169,98,0.28),inset_0_1px_0_rgba(255,255,255,0.14)]
              hover:brightness-105"
          >
            <span className="text-[16px] leading-none font-black">+</span>
            <span className="hidden sm:inline">Add Partner</span>
          </button>
        </div>
      </div>

      {healthStats && (healthStats.at_risk + healthStats.cold) > 0 && (
        <Link
          href="/admin/partners/health"
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20 hover:border-amber-400/40 transition-all group"
        >
          <Icon name="alertTriangle" className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[12px] text-amber-300 flex-1">
            <span className="font-semibold">{healthStats.at_risk + healthStats.cold} partner{(healthStats.at_risk + healthStats.cold) !== 1 ? "s" : ""}</span>
            {" "}haven't booked in 15+ days.
          </p>
          <span className="text-[11px] font-semibold text-amber-400 group-hover:underline">View Health</span>
          <Icon name="chevronRight" className="w-3.5 h-3.5 text-amber-400" />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-8">
        <KpiCard label="Total Partners" value={String(partners.length)} sub="organizations" />
        <KpiCard label="Active" value={String(activeCount)} sub="enabled accounts" accent={activeCount > 0} />
        <KpiCard label="New (90d)" value={String(recentCount)} sub="recently joined" />
      </div>


      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          {fetchError}
        </div>
      )}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 border-b border-[var(--brd)]/30">
        {typeTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] opacity-60">({typeCounts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {activeTab === "realtor" ? (
        <DataTable
          data={realtors}
          columns={realtorColumns}
          keyField="id"
          searchPlaceholder="Search agents, brokerages, email…"
          exportFilename="realtors"
          tableId="all-partners-realtors"
          onRowClick={() => router.push("/admin/partners/realtors")}
          emptyMessage="No realtors in the database yet"
          emptySubtext="Add agents under Partners → Realtors & referrals."
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyField="id"
          searchPlaceholder="Search by company, contact, email..."
          exportFilename="partners"
          tableId="all-partners-v2"
          onRowClick={(p) => router.push(`/admin/clients/${p.id}`)}
          emptyMessage="No partners found"
          emptySubtext={activeTab !== "all" ? `No ${getTypeLabel(activeTab)} partners yet` : undefined}
        />
      )}

      <InvitePartnerModal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          // Refresh partner list after onboarding
          fetch("/api/admin/partners/list")
            .then((r) => r.json())
            .then((d) => { if (Array.isArray(d.partners)) setPartners(d.partners); })
            .catch(() => {});
        }}
      />
    </div>
  );
}
