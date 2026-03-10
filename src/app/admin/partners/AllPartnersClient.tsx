"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/AppIcons";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";

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
  b2b: "B2B",
  retail: "Retail",
  designer: "Designer",
  hospitality: "Hospitality",
  gallery: "Art Gallery",
  realtor: "Realtor",
};

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
          {active ? "Active" : p.status}
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
  const [activeTab, setActiveTab] = useState("all");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/partners/b2b-list");
        const json = await res.json();
        setPartners(Array.isArray(json.partners) ? json.partners : []);
      } catch {
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
    for (const p of partners) {
      const t = p.type || "other";
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [partners]);

  const typeTabs = useMemo(() => {
    const allTab = { key: "all", label: "All Partners" };
    const types = Array.from(new Set(partners.map((p) => p.type || "other").filter(Boolean))).sort();
    const typeTabsList = types.map((key) => ({ key, label: getTypeLabel(key) }));
    return [allTab, ...typeTabsList];
  }, [partners]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-hero text-[28px] font-bold text-[var(--tx)]">B2B Partners</h1>
          <p className="text-[13px] text-[var(--tx3)]">{partners.length} partner organizations</p>
        </div>
      </div>

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
        selectable
        onRowClick={(p) => router.push(`/admin/clients/${p.id}`)}
        emptyMessage="No partners found"
        emptySubtext={activeTab !== "all" ? `No ${getTypeLabel(activeTab)} partners yet` : undefined}
      />
    </div>
  );
}
