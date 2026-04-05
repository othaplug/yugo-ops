"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/app/admin/components/Toast";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

type DeliveryPortalDefaults = {
  schedule_deliveries: boolean;
  day_rates: boolean;
  recurring_schedules: boolean;
  monthly_statements: boolean;
  delivery_history: boolean;
  projects: boolean;
};

const DELIVERY_DEFAULT_EVERYTHING: DeliveryPortalDefaults = {
  schedule_deliveries: true,
  day_rates: true,
  recurring_schedules: true,
  monthly_statements: true,
  delivery_history: true,
  projects: false,
};

// ─── Vertical defaults (mirrors the DB migration defaults) ────────────────────
export const VERTICAL_DEFAULTS: Record<string, DeliveryPortalDefaults> = {
  furniture_retailer: { ...DELIVERY_DEFAULT_EVERYTHING },
  cabinetry: { ...DELIVERY_DEFAULT_EVERYTHING },
  flooring: { ...DELIVERY_DEFAULT_EVERYTHING },
  interior_designer: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true, recurring_schedules: false },
  art_gallery: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true, day_rates: false, recurring_schedules: false },
  antique_dealer: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true, day_rates: false, recurring_schedules: false },
  hospitality: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true },
  medical_equipment: { ...DELIVERY_DEFAULT_EVERYTHING, day_rates: false, recurring_schedules: false },
  av_technology: { ...DELIVERY_DEFAULT_EVERYTHING, day_rates: false, recurring_schedules: false },
  appliances: { ...DELIVERY_DEFAULT_EVERYTHING, day_rates: false, recurring_schedules: false },
  realtor: { ...DELIVERY_DEFAULT_EVERYTHING, schedule_deliveries: false, day_rates: false, recurring_schedules: false, monthly_statements: false, delivery_history: false },
  property_manager: { ...DELIVERY_DEFAULT_EVERYTHING, schedule_deliveries: false, day_rates: false, recurring_schedules: false, monthly_statements: false, delivery_history: false },
  developer: { ...DELIVERY_DEFAULT_EVERYTHING, schedule_deliveries: false, day_rates: false, recurring_schedules: false, monthly_statements: false, delivery_history: false },
  retail: { ...DELIVERY_DEFAULT_EVERYTHING },
  designer: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true, recurring_schedules: false },
  gallery: { ...DELIVERY_DEFAULT_EVERYTHING, projects: true, day_rates: false, recurring_schedules: false },
};

const PM_VERTICAL_DEFAULTS: Record<
  string,
  {
    buildings_units: boolean;
    schedule_tenant_moves: boolean;
    renovation_projects: boolean;
    monthly_statements: boolean;
    move_history_pods: boolean;
    day_rates: boolean;
  }
> = {
  property_management_residential: {
    buildings_units: true,
    schedule_tenant_moves: true,
    renovation_projects: true,
    monthly_statements: true,
    move_history_pods: true,
    day_rates: false,
  },
  property_management_commercial: {
    buildings_units: true,
    schedule_tenant_moves: true,
    renovation_projects: true,
    monthly_statements: true,
    move_history_pods: true,
    day_rates: false,
  },
  developer_builder: {
    buildings_units: true,
    schedule_tenant_moves: true,
    renovation_projects: true,
    monthly_statements: true,
    move_history_pods: true,
    day_rates: false,
  },
};

const DELIVERY_FEATURE_META = [
  { key: "schedule_deliveries", label: "Schedule Deliveries", desc: "Request and manage B2B deliveries from the portal" },
  { key: "day_rates", label: "Day Rates", desc: "Book a dedicated truck and crew for a full day" },
  { key: "recurring_schedules", label: "Recurring Schedules", desc: "Weekly or monthly recurring delivery slots" },
  { key: "monthly_statements", label: "Monthly Statements", desc: "Statements and billing documents" },
  { key: "delivery_history", label: "Delivery History & PODs", desc: "Completed jobs, proof of delivery, and documents" },
  { key: "projects", label: "Projects (multi-phase)", desc: "Multi-phase project management and item tracking" },
] as const;

const PM_FEATURE_META = [
  { key: "buildings_units",       label: "Buildings & Units",       desc: "Properties on contract, units, access, and contacts" },
  { key: "schedule_tenant_moves", label: "Schedule Tenant Moves",   desc: "Book tenant moves with PM rate card pricing" },
  { key: "renovation_projects",   label: "Renovation Projects",     desc: "Track multi-unit renovation and displacement programs" },
  { key: "monthly_statements",    label: "Monthly Statements",      desc: "View and download portfolio billing statements" },
  { key: "move_history_pods",     label: "Move History & PODs",     desc: "Completed jobs, proof of delivery, and documents" },
  { key: "day_rates",           label: "Day Rates (optional)",    desc: "Some PM accounts also book dedicated crew days" },
] as const;

type DeliveryFeatureKey = typeof DELIVERY_FEATURE_META[number]["key"];
type PmFeatureKey = typeof PM_FEATURE_META[number]["key"];

interface PortalFeatures {
  schedule_deliveries?: boolean;
  projects?: boolean;
  day_rates?: boolean;
  recurring_schedules?: boolean;
  monthly_statements?: boolean;
  delivery_history?: boolean;
  buildings_units?: boolean;
  schedule_tenant_moves?: boolean;
  renovation_projects?: boolean;
  move_history_pods?: boolean;
}

interface Props {
  orgId: string;
  vertical?: string | null;
  initialFeatures?: PortalFeatures | null;
  onSaved?: () => void;
}

export default function PartnerPortalFeaturesCard({ orgId, vertical, initialFeatures, onSaved }: Props) {
  const { toast } = useToast();
  const [features, setFeatures] = useState<PortalFeatures>(initialFeatures ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const v = vertical || "";
  const isPmVertical = isPropertyManagementDeliveryVertical(v);
  const deliveryDefaults = isPmVertical ? null : (VERTICAL_DEFAULTS[v] ?? DELIVERY_DEFAULT_EVERYTHING);
  const pmDefaults = PM_VERTICAL_DEFAULTS[v] ?? PM_VERTICAL_DEFAULTS.property_management_residential;

  const defaults = isPmVertical ? pmDefaults : deliveryDefaults;

  const featureMeta = useMemo(() => (isPmVertical ? PM_FEATURE_META : DELIVERY_FEATURE_META), [isPmVertical]);

  useEffect(() => {
    setFeatures(initialFeatures ?? {});
    setDirty(false);
  }, [orgId, initialFeatures]);

  const toggle = (key: DeliveryFeatureKey | PmFeatureKey) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key as keyof PortalFeatures] }));
    setDirty(true);
  };

  const resetToDefaults = () => {
    if (!defaults) return;
    setFeatures({ ...defaults });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_features: features }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast("Portal features saved", "check");
      setDirty(false);
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Portal Features</div>
          <p className="text-[11px] text-[var(--tx3)]">
            {isPmVertical
              ? "Portfolio portal: buildings, tenant moves, programs, and billing — not B2B delivery scheduling."
              : "Control which sections appear in this partner's portal."}
          </p>
        </div>
        {defaults && (
          <button
            type="button"
            onClick={resetToDefaults}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Reset to vertical defaults
          </button>
        )}
      </div>

      <div className="space-y-3">
        {featureMeta.map(({ key, label, desc }) => {
          const enabled = features[key as keyof PortalFeatures] === true;
          const defaultVal = defaults ? (defaults as Record<string, boolean>)[key] : undefined;
          return (
            <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--brd)]/60 hover:border-[var(--brd)] transition-colors">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggle(key)}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
                  enabled ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--bg)]  border border-[var(--brd)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-4" : ""
                  }`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-[var(--tx)]">{label}</span>
                  {defaultVal !== undefined && (
                    <span className="text-[9px] text-[var(--tx3)] border border-[var(--brd)] rounded px-1.5 py-0.5">
                      default: {defaultVal ? "ON" : "OFF"}
                    </span>
                  )}
                  {defaultVal !== undefined && enabled !== defaultVal && (
                    <span className="text-[9px] font-semibold text-[var(--gold)] border border-[var(--gold)]/30 bg-[var(--gdim)] rounded px-1.5 py-0.5">
                      overridden
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">{desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {dirty && (
        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--brd)]/30">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
