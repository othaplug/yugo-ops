"use client";

import { useState } from "react";

interface Vendor {
  vendor: string;
  items: string;
  status: string;
  eta: string;
}

interface Project {
  id: string;
  name: string;
  address: string;
  installDate: string;
  percent: number;
  vendors: Vendor[];
  vendorCount: number;
  deliveredCount: number;
  delayedCount: number;
}

const VENDOR_STATUS_LABEL: Record<string, string> = {
  done: "RECEIVED",
  transit: "IN TRANSIT",
  wait: "PENDING",
  late: "DELAYED",
  received: "RECEIVED",
  in_transit: "IN TRANSIT",
  pending: "PENDING",
  delayed: "DELAYED",
};

const VENDOR_STATUS_COLOR: Record<string, string> = {
  done: "text-[#2D9F5A]",
  received: "text-[#2D9F5A]",
  transit: "text-[#D48A29]",
  in_transit: "text-[#D48A29]",
  wait: "text-[#888]",
  pending: "text-[#888]",
  late: "text-[#D14343]",
  delayed: "text-[#D14343]",
};

const VENDOR_STATUS_ICON: Record<string, string> = {
  done: "check",
  received: "check",
  transit: "truck",
  in_transit: "truck",
  wait: "clock",
  pending: "clock",
  late: "alert",
  delayed: "alert",
};

export default function PartnerProjectsTab({ projects, onShareProject }: {
  projects: Project[];
  onShareProject?: (projectId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(projects.length > 0 ? projects[0].id : null);

  if (projects.length === 0) {
    return (
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
        <p className="text-[14px] text-[#888]">No active projects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const isExpanded = expandedId === project.id;
        const hasDelay = project.delayedCount > 0;

        return (
          <div key={project.id} className="bg-white border border-[#E8E4DF] rounded-xl overflow-hidden hover:border-[#C9A962]/40 transition-colors">
            {/* Project Header */}
            <div
              className="p-5 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : project.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[17px] font-bold text-[#1A1A1A] font-serif">{project.name}</h3>
                  <p className="text-[12px] text-[#888] mt-0.5">
                    {project.address} — {project.vendorCount} vendor{project.vendorCount !== 1 ? "s" : ""} — {project.installDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasDelay && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Delay
                    </span>
                  )}
                  {onShareProject && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onShareProject(project.id); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E8E4DF] text-[#888] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      Share
                    </button>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"
                    className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 bg-[#E8E4DF] rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#2D9F5A] rounded-full transition-all duration-500"
                  style={{ width: `${project.percent}%` }}
                />
              </div>
              <div className="text-right text-[11px] text-[#888] mt-1 font-medium">{project.percent}%</div>
            </div>

            {/* Vendor List (expanded) */}
            {isExpanded && (
              <div className="border-t border-[#E8E4DF] px-5 py-3">
                <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888] mb-3">Vendor Receiving</div>
                <div className="space-y-2.5">
                  {project.vendors.map((v, i) => {
                    const statusKey = (v.status || "").toLowerCase();
                    const label = VENDOR_STATUS_LABEL[statusKey] || v.status;
                    const colorClass = VENDOR_STATUS_COLOR[statusKey] || "text-[#888]";
                    const iconType = VENDOR_STATUS_ICON[statusKey] || "clock";

                    return (
                      <div key={`${v.vendor}-${i}`} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <VendorIcon type={iconType} status={statusKey} />
                          <div>
                            <span className="text-[13px] font-semibold text-[#1A1A1A]">{v.vendor}</span>
                            <span className="text-[12px] text-[#888] ml-1.5">— {v.items}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold tracking-wider ${colorClass}`}>
                            {label} {v.eta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VendorIcon({ type, status }: { type: string; status: string }) {
  const colors: Record<string, string> = {
    done: "#2D9F5A",
    received: "#2D9F5A",
    transit: "#D48A29",
    in_transit: "#D48A29",
    wait: "#888",
    pending: "#888",
    late: "#D14343",
    delayed: "#D14343",
  };
  const color = colors[status] || "#888";

  if (type === "check") {
    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    );
  }
  if (type === "truck") {
    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      </div>
    );
  }
  if (type === "alert") {
    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </div>
  );
}
