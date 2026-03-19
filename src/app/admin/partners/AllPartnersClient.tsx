"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

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
  b2b: "Partner",
};

const TYPE_TAB_KEYS = ["all", "retail", "designer", "hospitality", "gallery", "realtor"] as const;

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "Other");
}

const columns: ColumnDef<Partner>[] = [
  {
    id: "name",
    label: "Company",
    accessor: (p) => p.name,
    render: (p) => (
      <div>
        <div className="text-[13px] font-bold text-[var(--tx)]">{p.name}</div>
        {p.contact_name && <div className="text-[11px] text-[var(--tx3)]">{p.contact_name}</div>}
      </div>
    ),
  },
  {
    id: "type",
    label: "Type",
    accessor: (p) => p.type,
    render: (p) => (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)]">
        {getTypeLabel(p.type || "")}
      </span>
    ),
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

export default function AllPartnersClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      setFetchError(null);
      try {
        const res = await fetch("/api/admin/partners/list");
        const json = await res.json();
        if (!res.ok) {
          setFetchError(json?.error || res.statusText || "Failed to load partners");
          setPartners([]);
          return;
        }
        setPartners(Array.isArray(json.partners) ? json.partners : []);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to load partners");
        setPartners([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => (activeTab === "all" ? partners : partners.filter((p) => p.type === activeTab)),
    [partners, activeTab],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: partners.length };
    for (const key of TYPE_TAB_KEYS) {
      if (key !== "all") counts[key] = 0;
    }
    for (const p of partners) {
      const t = p.type || "other";
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [partners]);

  const typeTabs = useMemo(() => {
    const allTab = { key: "all", label: "All Partners" };
    const typeTabsList = TYPE_TAB_KEYS.filter((k) => k !== "all").map((key) => ({
      key,
      label: getTypeLabel(key),
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
      <div className="mb-8">
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">CRM</p>
        <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">B2B Partners</h1>
      </div>

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

      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        searchPlaceholder="Search by company, contact, email..."
        exportFilename="partners"
        tableId="all-partners"
        onRowClick={(p) => router.push(`/admin/clients/${p.id}`)}
        emptyMessage="No partners found"
        emptySubtext={activeTab !== "all" ? `No ${getTypeLabel(activeTab)} partners yet` : undefined}
      />
    </div>
  );
}
