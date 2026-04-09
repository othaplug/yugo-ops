"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getDeliveryDetailPath } from "@/lib/move-code";
import CreateDeliveryDropdown from "../../components/CreateDeliveryDropdown";
import { formatMoveDate, formatPlatformDisplay } from "@/lib/date-format";
import { toTitleCase } from "@/lib/format-text";
import { MagnifyingGlass, CaretRight } from "@phosphor-icons/react";

const STATUS_BADGE: Record<string, string> = {
  pending: "text-[var(--org)]",
  scheduled: "text-blue-600",
  confirmed: "text-[var(--grn)]",
  "in-transit": "text-[var(--gold)]",
  delivered: "text-[var(--grn)]",
  completed: "text-[var(--grn)]",
  cancelled: "text-[var(--red)]",
};

const ACTIVE_STATUSES = ["draft", "proposed", "active", "on_hold"];

export default function DesignerDashboard({
  orgs,
  deliveries,
  projects,
}: {
  orgs: any[];
  deliveries: any[];
  projects: any[];
}) {
  const allProjects = projects;

  const [activeTab, setActiveTab] = useState<"deliveries" | "projects" | "partners">("deliveries");
  const [selectedPartner, setSelectedPartner] = useState("all");
  const [search, setSearch] = useState("");

  const filteredDeliveries = useMemo(() => {
    let result = deliveries;
    if (selectedPartner !== "all") {
      const client = orgs.find((c: any) => c.id === selectedPartner);
      if (client) {
        result = result.filter((d: any) => d.organization_id === selectedPartner || d.client_name === client.name);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d: any) =>
        (d.customer_name || "").toLowerCase().includes(q) ||
        (d.delivery_number || "").toLowerCase().includes(q) ||
        (d.delivery_address || "").toLowerCase().includes(q) ||
        (d.client_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [deliveries, selectedPartner, search, orgs]);

  const tabs = [
    { key: "deliveries" as const, label: `Deliveries (${deliveries.length})` },
    { key: "projects" as const, label: `Projects (${allProjects.length})` },
    { key: "partners" as const, label: `Partners (${orgs.length})` },
  ];

  return (
    <div>
      {/* Tabs + Actions */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex gap-6 border-b border-[var(--brd)]/40 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-1 py-3 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === t.key
                  ? "text-[var(--gold)] border-[var(--gold)]"
                  : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CreateDeliveryDropdown
            type="designer"
            createProjectHref="/admin/projects/new?partnerType=designer"
            addPartnerHref="/admin/partners/new?partnerType=designer"
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        {activeTab === "deliveries" && (
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4">Deliveries</div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-4 mb-4 border-b border-[var(--brd)]/30">
              <div className="relative flex-1">
                <MagnifyingGlass size={15} weight="regular" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx2)]" aria-hidden />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deliveries…" className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] py-2 pl-10 pr-3 text-[12px] text-[var(--tx)] transition-colors placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]" />
              </div>
              <select value={selectedPartner} onChange={(e) => setSelectedPartner(e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors min-w-[160px]">
                <option value="all">All Partners</option>
                {orgs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="divide-y divide-[var(--brd)]/50">
              {filteredDeliveries.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-[var(--tx3)]">
                  {search || selectedPartner !== "all" ? "No deliveries match your filter." : "No deliveries yet."}
                </div>
              ) : filteredDeliveries.slice(0, 25).map((d: any) => {
                const statusLabel = toTitleCase(d.status || "");
                const badgeClass = STATUS_BADGE[(d.status || "").toLowerCase()] || "text-[var(--tx3)] bg-[var(--bg)]";
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors">
                    <Link href={getDeliveryDetailPath(d)} className="flex items-center justify-between min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--tx)] truncate">{d.customer_name || d.delivery_number}</span>
                          <span className="text-[10px] text-[var(--tx3)] font-mono flex-shrink-0">{d.delivery_number}</span>
                        </div>
                        <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">
                          {d.client_name && <span className="font-medium">{d.client_name}</span>}
                          {d.delivery_address && <span> · {d.delivery_address}</span>}
                          {d.scheduled_date && <span> · {formatMoveDate(d.scheduled_date)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-[10px] text-[var(--tx3)]">{Array.isArray(d.items) ? d.items.length : 0} items</span>
                        <span className={`dt-badge tracking-[0.04em] ${badgeClass}`}>{statusLabel}</span>
                        <CaretRight size={14} weight="regular" className="flex-shrink-0 text-[var(--tx3)]" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4 flex items-center justify-between">
              <span>Projects</span>
              <Link href="/admin/deliveries?view=projects" className="admin-view-all-link">
                View all projects
              </Link>
            </div>
            <div className="divide-y divide-[var(--brd)]/30">
              {allProjects.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[12px] text-[var(--tx3)] mb-2">No projects yet.</p>
                  <Link href="/admin/projects/new?partnerType=designer" className="text-[12px] font-semibold text-[var(--gold)] hover:underline">Create your first designer project →</Link>
                </div>
              ) : allProjects.map((project) => {
                const org = Array.isArray(project.organizations) ? project.organizations[0] : project.organizations;
                const partnerName = org?.name || "-";
                const isActive = ACTIVE_STATUSES.includes(project.status || "");
                const statusLabel = (project.status || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                return (
                  <div key={project.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors">
                    <Link href={`/admin/projects/${project.id}?from=designers`} className="flex items-center justify-between min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--tx)] truncate">{project.project_name}</span>
                          {isActive && <span className="dt-badge tracking-[0.04em] text-[var(--grn)]">Active</span>}
                          <span className="text-[10px] text-[var(--tx3)] font-mono">{project.project_number}</span>
                        </div>
                        <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">
                          {partnerName}
                          {project.site_address && ` · ${project.site_address}`}
                          {project.target_end_date && ` · ${formatPlatformDisplay(new Date(project.target_end_date + "T00:00:00"), { month: "short", day: "numeric" })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className={`dt-badge tracking-[0.04em] ${isActive ? "text-[var(--grn)]" : "text-[var(--gold)]"}`}>{statusLabel}</span>
                        <CaretRight size={14} weight="regular" className="text-[var(--tx3)]" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "partners" && (
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4">Partners</div>
            <div className="divide-y divide-[var(--brd)]/30">
            {orgs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] text-[var(--tx3)]">No designer partners yet.</p>
                <Link href="/admin/partners/new?partnerType=designer" className="text-[12px] font-semibold text-[var(--gold)] hover:underline mt-1 inline-block">Add your first partner</Link>
              </div>
            ) : orgs.map((c: any) => {
              const designerDeliveries = deliveries.filter((d: any) => d.client_name === c.name);
              return (
                <Link key={c.id} href={`/admin/clients/${c.id}?from=designers`} className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{c.name}</div>
                      <div className="text-[11px] text-[var(--tx3)]">{[c.contact_name, c.email].filter(Boolean).join(" · ") || "-"}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-[11px] font-semibold text-[var(--tx)]">{designerDeliveries.length} deliveries</div>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
