"use client";

import { useState, useEffect } from "react";
import { ReferralPartnersOverviewHint } from "@/components/admin/ReferralPartnersOverviewHint";
import { useToast } from "../../components/Toast";

type CommissionMode = "pct_5" | "pct_10" | "flat_50" | "custom";

type ReferralShape = {
  enabled?: boolean;
  commission_mode?: CommissionMode;
  commission_custom?: string;
  referral_code?: string;
};

export default function PartnerReferralSection({
  orgId,
  portalFeatures,
  onSaved,
}: {
  orgId: string;
  portalFeatures: Record<string, unknown> | null | undefined;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const initialRp = (portalFeatures?.referral_program as ReferralShape) || {};
  const [enabled, setEnabled] = useState(!!initialRp.enabled);
  const [commissionMode, setCommissionMode] = useState<CommissionMode>(initialRp.commission_mode || "pct_5");
  const [commissionCustom, setCommissionCustom] = useState(initialRp.commission_custom || "");
  const [referralCode, setReferralCode] = useState(initialRp.referral_code || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const rp = (portalFeatures?.referral_program as ReferralShape) || {};
    setEnabled(!!rp.enabled);
    setCommissionMode(rp.commission_mode || "pct_5");
    setCommissionCustom(rp.commission_custom || "");
    setReferralCode(rp.referral_code || "");
  }, [orgId, portalFeatures]);

  const save = async () => {
    setSaving(true);
    try {
      const referral_program: ReferralShape = {
        enabled,
        commission_mode: commissionMode,
        referral_code: referralCode.trim() || undefined,
        ...(commissionMode === "custom" ? { commission_custom: commissionCustom.trim() || undefined } : {}),
      };
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_features: { referral_program } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast("Referral program updated", "check");
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 pb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">Referral program</div>
        <ReferralPartnersOverviewHint
          iconSize={14}
          ariaLabel="About referral partners vs service partners"
        />
      </div>
      <p className="text-[11px] text-[var(--tx3)] mb-4">
        Service partners contract Yugo for on-site moves. Referral partners send personal-move leads for a commission. A PM company can be both — track the referral relationship here separately from the service contract.
      </p>
      <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border border-[var(--brd)] bg-[var(--bgsub)] accent-[var(--gold)]"
        />
        This partner also participates in the referral program
      </label>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Commission</label>
          <select
            value={commissionMode}
            onChange={(e) => setCommissionMode(e.target.value as CommissionMode)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)]"
          >
            <option value="pct_5">5%</option>
            <option value="pct_10">10%</option>
            <option value="flat_50">Flat $50</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Referral code</label>
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="e.g. ANDO-REF-XXXX"
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </div>
      </div>
      {commissionMode === "custom" && (
        <div className="mb-4">
          <label className="block text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Custom commission note</label>
          <input
            value={commissionCustom}
            onChange={(e) => setCommissionCustom(e.target.value)}
            placeholder="Describe rate (e.g. $75 per closed referral)"
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save referral settings"}
      </button>
    </div>
  );
}
