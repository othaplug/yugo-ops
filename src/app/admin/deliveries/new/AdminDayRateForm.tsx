"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import DeliveryDayForm from "@/components/delivery-day/DeliveryDayForm";
import { organizationTypeLabel } from "@/lib/partner-type";

interface Org {
  id: string;
  name: string;
  type: string;
  vertical?: string | null;
  contact_name?: string | null;
  default_pickup_address?: string | null;
}

const fieldInput =
  "field-input-compact w-full";

export default function AdminDayRateForm({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOrg = organizations.find((o) => o.id === organizationId);
  const filteredOrgs = organizations.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.name?.toLowerCase().includes(q) || o.contact_name?.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!organizationId || !selectedOrg) {
    return (
      <div className="space-y-4">
        <h2 className="admin-section-h2">Day Rate, Select Partner</h2>
        <div className="relative" ref={dropdownRef}>
          <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Partner / Organization</label>
          <input
            value={search || (selectedOrg?.name ?? "")}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search partners…"
            className={fieldInput}
          />
          {showDropdown && filteredOrgs.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg max-h-[220px] overflow-y-auto">
              {filteredOrgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setOrganizationId(o.id); setSearch(o.name); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-2.5 text-[13px] text-[var(--tx)] hover:bg-[var(--bg)] transition-colors border-b border-[var(--brd)] last:border-0"
                >
                  <span className="font-semibold">{o.name}</span>
                  {o.type && (
                    <span className="text-[var(--tx3)] ml-1">· {organizationTypeLabel(o.vertical || o.type)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="admin-section-h2">Day Rate, {selectedOrg.name}</h2>
        <button
          type="button"
          onClick={() => setOrganizationId("")}
          className="text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--accent-text)]"
        >
          Change partner
        </button>
      </div>
      <DeliveryDayForm
        orgId={selectedOrg.id}
        orgType={selectedOrg.vertical || selectedOrg.type || "retail"}
        initialPickupAddress={selectedOrg.default_pickup_address || ""}
        createApiUrl="/api/admin/deliveries/create"
        extraCreatePayload={{ organization_id: selectedOrg.id }}
        priceApiUrl="/api/admin/deliveries/price"
        priceRequestExtra={{ organization_id: selectedOrg.id }}
        onSuccess={() => router.push("/admin/deliveries")}
        onBackToConfig={() => setOrganizationId("")}
      />
    </div>
  );
}
