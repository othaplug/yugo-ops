"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/app/admin/components/Toast";

// ─── Vertical defaults (mirrors the DB migration defaults) ────────────────────
export const VERTICAL_DEFAULTS: Record<string, { projects: boolean; day_rates: boolean; recurring_schedules: boolean }> = {
  furniture_retailer:    { projects: false, day_rates: true,  recurring_schedules: true  },
  cabinetry:             { projects: false, day_rates: true,  recurring_schedules: true  },
  flooring:              { projects: false, day_rates: true,  recurring_schedules: true  },
  interior_designer:     { projects: true,  day_rates: true,  recurring_schedules: false },
  art_gallery:           { projects: true,  day_rates: false, recurring_schedules: false },
  antique_dealer:        { projects: true,  day_rates: false, recurring_schedules: false },
  hospitality:           { projects: true,  day_rates: true,  recurring_schedules: true  },
  medical_equipment:     { projects: false, day_rates: false, recurring_schedules: false },
  av_technology:         { projects: false, day_rates: false, recurring_schedules: false },
  appliances:            { projects: false, day_rates: false, recurring_schedules: false },
  realtor:               { projects: false, day_rates: false, recurring_schedules: false },
  property_manager:      { projects: false, day_rates: false, recurring_schedules: false },
  developer:             { projects: false, day_rates: false, recurring_schedules: false },
  // legacy
  retail:                { projects: false, day_rates: true,  recurring_schedules: true  },
  designer:              { projects: true,  day_rates: true,  recurring_schedules: false },
  gallery:               { projects: true,  day_rates: false, recurring_schedules: false },
};

const FEATURE_META = [
  { key: "projects",            label: "Projects",             desc: "Multi-phase project management and item tracking" },
  { key: "day_rates",           label: "Day Rates",            desc: "Book a dedicated truck + crew for a full day" },
  { key: "recurring_schedules", label: "Recurring Schedules",  desc: "Set weekly or monthly recurring delivery slots" },
] as const;

type FeatureKey = typeof FEATURE_META[number]["key"];

interface PortalFeatures {
  projects?: boolean;
  day_rates?: boolean;
  recurring_schedules?: boolean;
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

  const defaults = VERTICAL_DEFAULTS[vertical || ""] ?? null;

  useEffect(() => {
    setFeatures(initialFeatures ?? {});
    setDirty(false);
  }, [orgId, initialFeatures]);

  const toggle = (key: FeatureKey) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
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
            Control which sections appear in this partner&apos;s portal.
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
        {FEATURE_META.map(({ key, label, desc }) => {
          const enabled = features[key] === true;
          const defaultVal = defaults?.[key];
          return (
            <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--brd)]/60 hover:border-[var(--brd)] transition-colors">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggle(key)}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
                  enabled ? "bg-[var(--gold)]" : "bg-[var(--bg)]  border border-[var(--brd)]"
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
            className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
