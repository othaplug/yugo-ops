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
          className="text-[12px] text-[var(--tx2)] hover:text-[var(--tx)]"
        >
          ← Buildings
        </Link>
        <h1 className="text-xl font-heading font-semibold text-[var(--tx)]">
          {isNew ? "Add building" : "Edit building"}
        </h1>

        <div className="space-y-3">
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Address *
            <input
              value={form.address}
              onChange={field("address")}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
              required
            />
          </label>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Building name
            <input
              value={form.building_name}
              onChange={field("building_name")}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
            />
          </label>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Postal code
            <input
              value={form.postal_code}
              onChange={field("postal_code")}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
            />
          </label>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Elevator system
            <select
              value={form.elevator_system}
              onChange={field("elevator_system")}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
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
            <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
              Complexity (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={form.complexity_rating}
                onChange={field("complexity_rating")}
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
              Extra min / trip
              <input
                type="number"
                min={0}
                value={form.estimated_extra_minutes_per_trip}
                onChange={field("estimated_extra_minutes_per_trip")}
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
              />
            </label>
          </div>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Elevator transfers (count)
            <input
              type="number"
              min={0}
              value={form.total_elevator_transfers}
              onChange={field("total_elevator_transfers")}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={form.has_commercial_tenants} onChange={field("has_commercial_tenants")} />
            Commercial tenants on site
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={form.elevator_shared} onChange={field("elevator_shared")} />
            Shared elevator
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={form.loading_dock} onChange={field("loading_dock")} />
            Loading dock
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={form.verified} onChange={field("verified")} />
            Verified
          </label>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Crew notes
            <textarea
              value={form.crew_notes}
              onChange={field("crew_notes")}
              rows={4}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
            />
          </label>
          <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
            Coordinator notes
            <textarea
              value={form.coordinator_notes}
              onChange={field("coordinator_notes")}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] text-[var(--tx)]"
            />
          </label>
        </div>

        {err ? <p className="text-[12px] text-red-700">{err}</p> : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.address.trim()}
          className="rounded-lg border border-[var(--brd)] px-4 py-2.5 text-[12px] font-semibold text-[var(--tx)] hover:bg-[var(--bg)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </PageContent>
  );
}
