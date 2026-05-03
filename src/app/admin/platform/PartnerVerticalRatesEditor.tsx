"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toast";

type VerticalCatalogRow = { code: string; name: string };
type PartnerRateRow = {
  id?: string;
  vertical_code: string;
  custom_rates?: Record<string, unknown>;
};

type VerticalRatesPayload = {
  verticals: VerticalCatalogRow[];
  rates: PartnerRateRow[];
  recommended_vertical_code?: string | null;
  portfolio_b2b_overrides_notice?: boolean;
};

/** Initial selection = partner CRM category → catalog code; JSON from saved overrides for that row only. */
function initialSelectionAfterLoad(p: VerticalRatesPayload): { code: string; jsonStr: string } {
  const verticalCodes = new Set((p.verticals || []).map((v) => v.code));
  const rates = Array.isArray(p.rates) ? p.rates : [];
  let code = typeof p.recommended_vertical_code === "string" ? p.recommended_vertical_code.trim() : "";
  if (!code || !verticalCodes.has(code)) {
    code =
      [...verticalCodes].find((c) => c === "custom") ??
      [...verticalCodes][0] ??
      "";
  }
  const row = rates.find((r) => r.vertical_code === code);
  const overrides = row?.custom_rates;
  return {
    code,
    jsonStr: JSON.stringify(overrides && typeof overrides === "object" ? overrides : {}, null, 2),
  };
}

export default function PartnerVerticalRatesEditor({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [verticals, setVerticals] = useState<VerticalCatalogRow[]>([]);
  const [savedRatesByVertical, setSavedRatesByVertical] = useState<PartnerRateRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [jsonStr, setJsonStr] = useState("{\n  \n}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recommendedCode, setRecommendedCode] = useState<string>("");
  const [portfolioNotice, setPortfolioNotice] = useState(false);

  const applyPayload = (p: VerticalRatesPayload, pinVertical?: string | null) => {
    setVerticals(p.verticals);
    setSavedRatesByVertical(Array.isArray(p.rates) ? p.rates : []);
    const rec =
      typeof p.recommended_vertical_code === "string" ? p.recommended_vertical_code.trim() : "";
    setRecommendedCode(rec);
    setPortfolioNotice(!!p.portfolio_b2b_overrides_notice);

    const verticalCodes = new Set((p.verticals || []).map((v) => v.code));
    const pin =
      typeof pinVertical === "string" && verticalCodes.has(pinVertical.trim())
        ? pinVertical.trim()
        : null;

    if (pin) {
      const row = (p.rates || []).find((r) => r.vertical_code === pin);
      setSelectedCode(pin);
      setJsonStr(
        JSON.stringify(row?.custom_rates && typeof row.custom_rates === "object" ? row.custom_rates : {}, null, 2),
      );
      return;
    }

    const { code, jsonStr: js } = initialSelectionAfterLoad(p);
    setSelectedCode(code);
    setJsonStr(js);
  };

  const load = useCallback(
    async (pinVertical?: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/organizations/${organizationId}/vertical-rates`, {
          credentials: "same-origin",
        });
        const d = (await res.json()) as VerticalRatesPayload & { error?: string };
        if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Load failed");
        const payload: VerticalRatesPayload = {
          verticals: Array.isArray(d.verticals) ? d.verticals : [],
          rates: Array.isArray(d.rates) ? d.rates : [],
          recommended_vertical_code: d.recommended_vertical_code ?? "",
          portfolio_b2b_overrides_notice: !!d.portfolio_b2b_overrides_notice,
        };
        applyPayload(payload, pinVertical);
      } catch (e) {
        setVerticals([]);
        setSavedRatesByVertical([]);
        setRecommendedCode("");
        setPortfolioNotice(false);
        toast(e instanceof Error ? e.message : "Could not load vertical overrides", "x");
      } finally {
        setLoading(false);
      }
    },
    [organizationId, toast],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const onSelectVertical = (code: string) => {
    setSelectedCode(code);
    const hit = savedRatesByVertical.find((r) => r.vertical_code === code);
    setJsonStr(
      JSON.stringify(hit?.custom_rates && typeof hit.custom_rates === "object" ? hit.custom_rates : {}, null, 2),
    );
  };

  const save = async () => {
    let custom_rates: Record<string, unknown>;
    try {
      custom_rates = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      toast("Invalid JSON", "x");
      return;
    }
    setSaving(true);
    try {
      const verticalToPin = selectedCode;
      const res = await fetch(`/api/admin/organizations/${organizationId}/vertical-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ vertical_code: verticalToPin, custom_rates }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Save failed", "x");
        return;
      }
      toast("Partner vertical overrides saved", "check");
      await load(verticalToPin);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="px-5 pb-3 text-[11px] text-[var(--tx3)]">Loading B2B vertical overrides…</p>;
  }

  if (verticals.length === 0) {
    return (
      <p className="px-5 pb-3 text-[11px] text-[var(--tx3)]">
        No delivery verticals in the database yet. Add them under Platform → Delivery verticals.
      </p>
    );
  }

  const defaultLabel =
    verticals.find((v) => v.code === recommendedCode)?.name ||
    verticals.find((v) => v.code === "custom")?.name ||
    recommendedCode;

  return (
    <div
      className="px-5 pb-4 space-y-2 border-t border-[var(--brd)]/50 pt-3 mt-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">B2B quote rate overrides</p>
      <p className="text-[10px] text-[var(--tx3)] leading-snug">
        When this partner is on a B2B quote, these values layer on top of the catalog service you selected. Wrong
        numbers will change live pricing.
      </p>
      {portfolioNotice ? (
        <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-snug bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
          Portfolio partners use tenant move contracts and matrix pricing for PM jobs. Retail B2B overrides here only
          apply when booking or quoting dimensional B2B work for this org. Defaults follow the CRM category (
          <span className="font-semibold">{defaultLabel || "recommended vertical"}</span>
          ).
        </p>
      ) : (
        <p className="text-[10px] text-[var(--tx3)] leading-snug">
          Default catalog vertical for this partner:{" "}
          <span className="font-semibold text-[var(--tx2)]">{defaultLabel || recommendedCode}</span>
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="block text-[9px] font-bold text-[var(--tx3)] mb-1">Vertical</label>
          <select
            value={selectedCode}
            onChange={(e) => onSelectVertical(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[12px] text-[var(--tx)]"
          >
            {verticals.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !selectedCode}
          className="admin-btn admin-btn-sm admin-btn-primary shrink-0"
        >
          {saving ? "Saving…" : "Save overrides"}
        </button>
      </div>
      <details className="rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/30 p-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--accent-text)]">
          Advanced: edit override data
        </summary>
        <p className="text-[10px] text-[var(--tx3)] mt-2 mb-2 leading-snug">
          For specialist use only. The app checks the format on save; if you are unsure, adjust catalog services under
          Platform instead.
        </p>
        <textarea
          value={jsonStr}
          onChange={(e) => setJsonStr(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[11px] font-mono text-[var(--tx)]"
          spellCheck={false}
          aria-label="Partner rate override data"
        />
      </details>
    </div>
  );
}
