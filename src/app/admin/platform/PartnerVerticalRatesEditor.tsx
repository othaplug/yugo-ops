"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toast";

export default function PartnerVerticalRatesEditor({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [verticals, setVerticals] = useState<{ code: string; name: string }[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [jsonStr, setJsonStr] = useState("{\n  \n}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/vertical-rates`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setVerticals(Array.isArray(d.verticals) ? d.verticals : []);
      const rates = (d.rates || []) as { vertical_code: string; custom_rates: Record<string, unknown> }[];
      const first = rates[0];
      if (first) {
        setSelectedCode(first.vertical_code);
        setJsonStr(JSON.stringify(first.custom_rates || {}, null, 2));
      } else if (d.verticals?.[0]?.code) {
        setSelectedCode(d.verticals[0].code);
        setJsonStr("{\n  \n}");
      }
    } catch {
      setVerticals([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSelectVertical = async (code: string) => {
    setSelectedCode(code);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/vertical-rates`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      const rates = (d.rates || []) as { vertical_code: string; custom_rates: Record<string, unknown> }[];
      const hit = rates.find((r) => r.vertical_code === code);
      setJsonStr(JSON.stringify(hit?.custom_rates ?? {}, null, 2));
    } catch {
      setJsonStr("{}");
    }
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
      const res = await fetch(`/api/admin/organizations/${organizationId}/vertical-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ vertical_code: selectedCode, custom_rates }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Save failed", "x");
        return;
      }
      toast("Partner vertical overrides saved", "check");
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

  return (
    <div
      className="px-5 pb-4 space-y-2 border-t border-[var(--brd)]/50 pt-3 mt-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">B2B quote rate overrides</p>
      <p className="text-[10px] text-[var(--tx3)] leading-snug">
        When this partner is on a B2B quote, these values layer on top of the catalog service you selected. Wrong numbers will change live pricing.
      </p>
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
          className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 shrink-0"
        >
          {saving ? "Saving…" : "Save overrides"}
        </button>
      </div>
      <details className="rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/30 p-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--gold)]">
          Advanced: edit override data
        </summary>
        <p className="text-[10px] text-[var(--tx3)] mt-2 mb-2 leading-snug">
          For specialist use only. The app checks the format on save; if you are unsure, adjust catalog services under Platform instead.
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
