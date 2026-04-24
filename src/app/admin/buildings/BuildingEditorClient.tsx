"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";

type Building = Record<string, unknown>;

export default function BuildingEditorClient({ initial }: { initial: Building | null }) {
  const router = useRouter();
  const isNew = !initial?.id;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    address: String(initial?.address ?? ""),
    building_name: String(initial?.building_name ?? ""),
    postal_code: String(initial?.postal_code ?? ""),
    building_type: String(initial?.building_type ?? "residential"),
    elevator_system: String(initial?.elevator_system ?? "standard"),
    complexity_rating: Number(initial?.complexity_rating ?? 3),
    estimated_extra_minutes_per_trip: Number(initial?.estimated_extra_minutes_per_trip ?? 5),
    total_elevator_transfers: Number(initial?.total_elevator_transfers ?? 0),
    crew_notes: String(initial?.crew_notes ?? ""),
    coordinator_notes: String(initial?.coordinator_notes ?? ""),
    has_commercial_tenants: !!initial?.has_commercial_tenants,
    elevator_shared: !!initial?.elevator_shared,
    loading_dock: !!initial?.loading_dock,
    verified: !!initial?.verified,
  }));

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const t = e.target;
    if (t.type === "checkbox") {
      setForm((f) => ({ ...f, [k]: (t as HTMLInputElement).checked }));
      return;
    }
    if (t.type === "number") {
      const n = Number((t as HTMLInputElement).value);
      setForm((f) => ({ ...f, [k]: Number.isFinite(n) ? n : 0 }));
      return;
    }
    setForm((f) => ({ ...f, [k]: t.value }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        complexity_rating: Number(form.complexity_rating),
        estimated_extra_minutes_per_trip: Number(form.estimated_extra_minutes_per_trip),
        total_elevator_transfers: Number(form.total_elevator_transfers),
      };
      const url = isNew ? "/api/admin/buildings" : `/api/admin/buildings/${String(initial?.id)}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      if (isNew && data.building?.id) {
        router.replace(`/admin/buildings/${data.building.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setErr("Save failed");
    } finally {
      setSaving(false);
    }
  }, [form, isNew, initial?.id, router]);

  return (
    <PageContent>
      <div className="max-w-xl mx-auto space-y-6 pb-12">
        <Link
          href="/admin/buildings"
          className="text-[12px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink-strong)]"
        >
          ← Buildings
        </Link>
        <h1 className="text-[22px] font-semibold text-[var(--yu3-ink-strong)] tracking-tight [font-family:var(--font-body)]">
          {isNew ? "Add building" : "Edit building"}
        </h1>

        <div className="space-y-4">
          <label className="block">
            <span className="admin-input-label">Address *</span>
            <input
              value={form.address}
              onChange={field("address")}
              className="admin-input"
              required
            />
          </label>
          <label className="block">
            <span className="admin-input-label">Building name</span>
            <input
              value={form.building_name}
              onChange={field("building_name")}
              className="admin-input"
            />
          </label>
          <label className="block">
            <span className="admin-input-label">Postal code</span>
            <input
              value={form.postal_code}
              onChange={field("postal_code")}
              className="admin-input"
            />
          </label>
          <label className="block">
            <span className="admin-input-label">Elevator system</span>
            <select
              value={form.elevator_system}
              onChange={field("elevator_system")}
              className="admin-select"
            >
              {[
                "standard",
                "split_transfer",
                "multi_transfer",
                "no_freight",
                "stairs_only",
              ].map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="admin-input-label">Complexity (1 to 5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.complexity_rating}
                onChange={field("complexity_rating")}
                className="admin-input"
              />
            </label>
            <label className="block">
              <span className="admin-input-label">Extra min / trip</span>
              <input
                type="number"
                min={0}
                value={form.estimated_extra_minutes_per_trip}
                onChange={field("estimated_extra_minutes_per_trip")}
                className="admin-input"
              />
            </label>
          </div>
          <label className="block">
            <span className="admin-input-label">Elevator transfers (count)</span>
            <input
              type="number"
              min={0}
              value={form.total_elevator_transfers}
              onChange={field("total_elevator_transfers")}
              className="admin-input"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--yu3-ink-strong)] cursor-pointer">
            <input type="checkbox" checked={form.has_commercial_tenants} onChange={field("has_commercial_tenants")} />
            Commercial tenants on site
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--yu3-ink-strong)] cursor-pointer">
            <input type="checkbox" checked={form.elevator_shared} onChange={field("elevator_shared")} />
            Shared elevator
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--yu3-ink-strong)] cursor-pointer">
            <input type="checkbox" checked={form.loading_dock} onChange={field("loading_dock")} />
            Loading dock
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--yu3-ink-strong)] cursor-pointer">
            <input type="checkbox" checked={form.verified} onChange={field("verified")} />
            Verified
          </label>
          <label className="block">
            <span className="admin-input-label">Crew notes</span>
            <textarea
              value={form.crew_notes}
              onChange={field("crew_notes")}
              rows={4}
              className="admin-textarea"
            />
          </label>
          <label className="block">
            <span className="admin-input-label">Coordinator notes</span>
            <textarea
              value={form.coordinator_notes}
              onChange={field("coordinator_notes")}
              rows={3}
              className="admin-textarea"
            />
          </label>
        </div>

        {err ? <p className="admin-field-helper admin-field-helper--error">{err}</p> : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.address.trim()}
          className="inline-flex items-center justify-center h-9 px-4 rounded-[var(--yu3-r-md)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[13px] font-semibold hover:bg-[var(--yu3-wine-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </PageContent>
  );
}
