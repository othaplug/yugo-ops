"use client";

import { useMemo } from "react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  CaretDown,
  CaretUp,
  Plus,
  Trash as Trash2,
  Warning,
} from "@phosphor-icons/react";
import { weightTierSelectOptions } from "@/lib/pricing/weight-tiers";
import type { B2bQuickAddPreset } from "@/lib/b2b-vertical-ui";
import { B2bQuickAddIcon } from "@/components/admin/b2b/b2b-quick-add-icon";
import type {
  MultiStopDraftStop,
  MultiStopDraftItem,
  ReadinessValue,
} from "./b2b-multi-stop-types";
import {
  createEmptyPickupStop,
  createEmptyDropoffStop,
  getDropStops,
  getPickupStops,
  newLocalId,
  reconcileItemDestinations,
  stampFinalDestination,
} from "./b2b-multi-stop-types";

const fieldInput = "field-input-compact w-full";

const ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground floor" },
  { value: "loading_dock", label: "Loading dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+ floor)" },
  { value: "long_carry", label: "Long carry" },
  { value: "narrow_stairs", label: "Narrow stairs" },
  { value: "no_parking_nearby", label: "No parking nearby" },
] as const;

const READINESS_OPTIONS: { value: ReadinessValue; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "delayed", label: "Delayed" },
];

const WEIGHT_OPTS = weightTierSelectOptions();

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function readinessDotClass(r: ReadinessValue): string {
  if (r === "confirmed") return "bg-emerald-500";
  if (r === "pending") return "bg-amber-400";
  if (r === "partial") return "bg-orange-500";
  return "bg-red-500";
}

export default function B2BMultiStopRouteSection({
  projectName,
  setProjectName,
  endClientName,
  setEndClientName,
  endClientPhone,
  setEndClientPhone,
  stops,
  setStops,
  stagedDelivery,
  setStagedDelivery,
  quickAddPresets,
  onQuickAdd,
}: {
  projectName: string;
  setProjectName: (v: string) => void;
  endClientName: string;
  setEndClientName: (v: string) => void;
  endClientPhone: string;
  setEndClientPhone: (v: string) => void;
  stops: MultiStopDraftStop[];
  setStops: React.Dispatch<React.SetStateAction<MultiStopDraftStop[]>>;
  stagedDelivery: boolean;
  setStagedDelivery: (v: boolean) => void;
  quickAddPresets: B2bQuickAddPreset[];
  onQuickAdd: (preset: B2bQuickAddPreset, stopLocalId: string) => void;
}) {
  const pickups = useMemo(() => getPickupStops(stops), [stops]);
  const drops = useMemo(() => getDropStops(stops), [stops]);
  const pickupCount = pickups.length;
  const dropCount = drops.length;
  const hasMultipleDrops = dropCount > 1;

  const unconfirmedPickups = useMemo(
    () => pickups.filter((s) => s.readiness !== "confirmed").length,
    [pickups],
  );

  const patchStop = (localId: string, patch: Partial<MultiStopDraftStop>) => {
    setStops((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)),
    );
  };

  const patchItem = (
    stopId: string,
    itemId: string,
    patch: Partial<MultiStopDraftItem>,
  ) => {
    setStops((prev) =>
      prev.map((s) => {
        if (s.localId !== stopId) return s;
        return {
          ...s,
          items: s.items.map((it) =>
            it.localId === itemId ? { ...it, ...patch } : it,
          ),
        };
      }),
    );
  };

  const addItemRow = (stopId: string) => {
    const row: MultiStopDraftItem = {
      localId: newLocalId(),
      description: "",
      quantity: 1,
      weight_range: "standard",
      fragile: false,
      is_high_value: false,
      requires_assembly: false,
    };
    setStops((prev) =>
      prev.map((s) =>
        s.localId === stopId ? { ...s, items: [...s.items, row] } : s,
      ),
    );
  };

  const removeItem = (stopId: string, itemId: string) => {
    setStops((prev) =>
      prev.map((s) =>
        s.localId === stopId
          ? { ...s, items: s.items.filter((it) => it.localId !== itemId) }
          : s,
      ),
    );
  };

  // Keep route order: all pickups first, then all drops. The LAST drop is
  // the final destination (stampFinalDestination enforces this). Items on
  // pickups carry a destinationStopLocalId pointing at one of the drops
  // (reconcileItemDestinations repairs stale pointers after remove/reorder).
  const addPickup = () => {
    setStops((prev) => {
      const pks = prev.filter((s) => s.stopType === "pickup");
      const dps = prev.filter((s) => s.stopType === "delivery");
      const insert = createEmptyPickupStop();
      insert.collapsed = pks.length >= 2;
      const next = [...pks, insert, ...dps];
      return reconcileItemDestinations(stampFinalDestination(next));
    });
  };

  const addDropoff = () => {
    setStops((prev) => {
      const pks = prev.filter((s) => s.stopType === "pickup");
      const dps = prev.filter((s) => s.stopType === "delivery");
      const insert = createEmptyDropoffStop();
      insert.collapsed = dps.length >= 2;
      const next = [...pks, ...dps, insert];
      return reconcileItemDestinations(stampFinalDestination(next));
    });
  };

  const removeStop = (localId: string) => {
    setStops((prev) => {
      const target = prev.find((s) => s.localId === localId);
      if (!target) return prev;
      const sameKind = prev.filter((s) => s.stopType === target.stopType);
      // Must keep at least one of each kind.
      if (sameKind.length <= 1) return prev;
      const next = prev.filter((s) => s.localId !== localId);
      return reconcileItemDestinations(stampFinalDestination(next));
    });
  };

  // Move within the stop's own kind only (pickups among pickups, drops among
  // drops) so the route order [pickups..., drops...] is preserved.
  const moveStop = (localId: string, dir: -1 | 1) => {
    setStops((prev) => {
      const target = prev.find((s) => s.localId === localId);
      if (!target) return prev;
      const pks = prev.filter((s) => s.stopType === "pickup");
      const dps = prev.filter((s) => s.stopType === "delivery");
      const bucket = target.stopType === "pickup" ? [...pks] : [...dps];
      const i = bucket.findIndex((s) => s.localId === localId);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= bucket.length) return prev;
      const t = bucket[i];
      bucket[i] = bucket[j]!;
      bucket[j] = t!;
      const next =
        target.stopType === "pickup" ? [...bucket, ...dps] : [...pks, ...bucket];
      return reconcileItemDestinations(stampFinalDestination(next));
    });
  };

  return (
    <div className="space-y-4">
      {unconfirmedPickups > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-[11px] text-[var(--tx)]">
            <Warning
              className="mt-0.5 shrink-0 text-amber-700"
              size={18}
              weight="duotone"
              aria-hidden
            />
            <span>
              {unconfirmedPickups} stop{unconfirmedPickups !== 1 ? "s" : ""}{" "}
              have unconfirmed readiness. Consider staged delivery.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStagedDelivery(true)}
            className="shrink-0 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--tx)] hover:border-[var(--gold)]"
          >
            Enable staged delivery
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Project name">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Grubner Suite 402, Glenhill Condominium"
            className={fieldInput}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="End client name">
          <input
            value={endClientName}
            onChange={(e) => setEndClientName(e.target.value)}
            placeholder="Recipient at delivery"
            className={fieldInput}
          />
        </Field>
        <Field label="End client phone">
          <input
            value={endClientPhone}
            onChange={(e) => setEndClientPhone(e.target.value)}
            placeholder="Phone"
            className={fieldInput}
          />
        </Field>
      </div>

      {stagedDelivery && (
        <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
          <input
            type="checkbox"
            checked={stagedDelivery}
            onChange={(e) => setStagedDelivery(e.target.checked)}
            className="accent-[var(--gold)]"
          />
          Staged delivery (assign phases per stop below)
        </label>
      )}

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">
          Stops
        </p>
        {stops.map((stop) => {
          const isPickup = stop.stopType === "pickup";
          const isFinal = stop.isFinalDestination;
          const pickupIndex = isPickup ? pickups.findIndex((p) => p.localId === stop.localId) + 1 : null;
          const dropIndex = !isPickup ? drops.findIndex((d) => d.localId === stop.localId) + 1 : null;
          const canRemove =
            isPickup ? pickups.length > 1 : drops.length > 1;
          const expanded = !stop.collapsed;
          return (
            <div
              key={stop.localId}
              className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() =>
                    patchStop(stop.localId, { collapsed: !stop.collapsed })
                  }
                >
                  <span className="mt-0.5 text-[var(--tx3)]" aria-hidden>
                    {expanded ? (
                      <CaretDown size={16} />
                    ) : (
                      <CaretUp size={16} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-[var(--tx)]">
                        {isPickup
                          ? `Stop ${pickupIndex} · Pickup`
                          : hasMultipleDrops
                            ? `Drop ${dropIndex} · Delivery${isFinal ? " (final)" : ""}`
                            : "Final delivery"}
                      </span>
                      {isPickup && (
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${readinessDotClass(stop.readiness)}`}
                          title={stop.readiness}
                          aria-hidden
                        />
                      )}
                      {stop.vendorName.trim() && (
                        <span className="truncate text-[10px] text-[var(--tx3)]">
                          {stop.vendorName}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-[var(--tx3)]">
                      {stop.address.trim() || "Address required"}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move stop up"
                    onClick={() => moveStop(stop.localId, -1)}
                    className="rounded-lg border border-[var(--brd)] p-1 text-[var(--tx)] hover:bg-[var(--bg)]"
                  >
                    <CaretUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move stop down"
                    onClick={() => moveStop(stop.localId, 1)}
                    className="rounded-lg border border-[var(--brd)] p-1 text-[var(--tx)] hover:bg-[var(--bg)]"
                  >
                    <CaretDown size={14} />
                  </button>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => removeStop(stop.localId)}
                      className="rounded-lg border border-[var(--brd)] p-1 text-[var(--red)] hover:bg-[var(--bg)]"
                      aria-label="Remove stop"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="mt-3 space-y-2 border-t border-[var(--brd)]/80 pt-3">
                  <Field label={isPickup ? "Vendor" : "Location label"}>
                    <input
                      value={stop.vendorName}
                      onChange={(e) =>
                        patchStop(stop.localId, {
                          vendorName: e.target.value,
                        })
                      }
                      className={fieldInput}
                      placeholder={
                        isPickup
                          ? "Vendor or location label"
                          : "e.g. Suite 402, Warehouse B"
                      }
                    />
                  </Field>
                  <Field label="Address">
                    <AddressAutocomplete
                      value={stop.address}
                      onChange={(r) =>
                        patchStop(stop.localId, {
                          address: r.fullAddress,
                          lat: r.lat,
                          lng: r.lng,
                        })
                      }
                      onRawChange={(raw) =>
                        patchStop(stop.localId, { address: raw, lat: null, lng: null })
                      }
                      placeholder={isFinal ? "Full delivery address" : "Pickup address"}
                      className={fieldInput}
                      variant="yu3"
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Access">
                      <select
                        value={stop.accessType}
                        onChange={(e) =>
                          patchStop(stop.localId, { accessType: e.target.value })
                        }
                        className={fieldInput}
                      >
                        {ACCESS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {isPickup && (
                      <Field label="Readiness">
                        <select
                          value={stop.readiness}
                          onChange={(e) =>
                            patchStop(stop.localId, {
                              readiness: e.target.value as ReadinessValue,
                            })
                          }
                          className={fieldInput}
                        >
                          {READINESS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  <Field label="Access notes">
                    <input
                      value={stop.accessNotes}
                      onChange={(e) =>
                        patchStop(stop.localId, { accessNotes: e.target.value })
                      }
                      className={fieldInput}
                      placeholder="Dock, buzzer, rear entrance…"
                    />
                  </Field>
                  {isPickup &&
                    (stop.readiness === "partial" ||
                      stop.readiness === "delayed") && (
                      <Field label="Readiness note">
                        <input
                          value={stop.readinessNotes}
                          onChange={(e) =>
                            patchStop(stop.localId, {
                              readinessNotes: e.target.value,
                            })
                          }
                          className={fieldInput}
                        />
                      </Field>
                    )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Contact name">
                      <input
                        value={stop.contactName}
                        onChange={(e) =>
                          patchStop(stop.localId, {
                            contactName: e.target.value,
                          })
                        }
                        className={fieldInput}
                      />
                    </Field>
                    <Field label="Contact phone">
                      <input
                        value={stop.contactPhone}
                        onChange={(e) =>
                          patchStop(stop.localId, {
                            contactPhone: e.target.value,
                          })
                        }
                        className={fieldInput}
                      />
                    </Field>
                  </div>
                  {stagedDelivery && (
                    <Field label="Phase">
                      <select
                        value={String(stop.deliveryPhase)}
                        onChange={(e) =>
                          patchStop(stop.localId, {
                            deliveryPhase: Number(e.target.value),
                          })
                        }
                        className={fieldInput}
                      >
                        <option value="1">Phase 1 (ready now)</option>
                        <option value="2">Phase 2 (when ready)</option>
                      </select>
                    </Field>
                  )}
                  <Field label="Stop notes">
                    <textarea
                      value={stop.notes}
                      onChange={(e) =>
                        patchStop(stop.localId, { notes: e.target.value })
                      }
                      rows={2}
                      className={`${fieldInput} resize-y`}
                    />
                  </Field>

                  {isPickup && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                          Items picked up here
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            addItemRow(stop.localId);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--brd)] px-2 py-1 text-[10px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
                        >
                          <Plus size={12} /> Add item
                        </button>
                      </div>
                      {quickAddPresets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {quickAddPresets.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => {
                                onQuickAdd(p, stop.localId);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--brd)] px-2 py-1 text-[9px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
                            >
                              {p.icon ? (
                                <B2bQuickAddIcon
                                  icon={p.icon}
                                  className="shrink-0 text-[var(--accent-text)]"
                                />
                              ) : (
                                <Plus size={10} className="shrink-0" />
                              )}
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        {stop.items.map((it) => (
                          <div
                            key={it.localId}
                            className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-2"
                          >
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                              <div className="sm:col-span-5">
                                <Field label="Description">
                                  <input
                                    value={it.description}
                                    onChange={(e) =>
                                      patchItem(stop.localId, it.localId, {
                                        description: e.target.value,
                                      })
                                    }
                                    className={fieldInput}
                                  />
                                </Field>
                              </div>
                              <div className="sm:col-span-2">
                                <Field label="Qty">
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.quantity}
                                    onChange={(e) =>
                                      patchItem(stop.localId, it.localId, {
                                        quantity: Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      })
                                    }
                                    className={fieldInput}
                                  />
                                </Field>
                              </div>
                              <div className="sm:col-span-5">
                                <Field label="Weight">
                                  <select
                                    value={it.weight_range}
                                    onChange={(e) =>
                                      patchItem(stop.localId, it.localId, {
                                        weight_range: e.target.value,
                                      })
                                    }
                                    className={fieldInput}
                                  >
                                    {WEIGHT_OPTS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                              </div>
                            </div>
                            {hasMultipleDrops && (
                              <div className="mt-2">
                                <Field label="Deliver to">
                                  <select
                                    value={it.destinationStopLocalId ?? drops[0]?.localId ?? ""}
                                    onChange={(e) =>
                                      patchItem(stop.localId, it.localId, {
                                        destinationStopLocalId: e.target.value,
                                      })
                                    }
                                    className={fieldInput}
                                  >
                                    {drops.map((d, i) => {
                                      const label =
                                        d.vendorName.trim() ||
                                        d.address.trim() ||
                                        `Drop ${i + 1}`;
                                      return (
                                        <option key={d.localId} value={d.localId}>
                                          Drop {i + 1} · {label}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </Field>
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--tx)]">
                              <label className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={it.fragile}
                                  onChange={(e) =>
                                    patchItem(stop.localId, it.localId, {
                                      fragile: e.target.checked,
                                    })
                                  }
                                  className="accent-[var(--gold)]"
                                />
                                Fragile
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={it.is_high_value}
                                  onChange={(e) =>
                                    patchItem(stop.localId, it.localId, {
                                      is_high_value: e.target.checked,
                                    })
                                  }
                                  className="accent-[var(--gold)]"
                                />
                                High value
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={it.requires_assembly}
                                  onChange={(e) =>
                                    patchItem(stop.localId, it.localId, {
                                      requires_assembly: e.target.checked,
                                    })
                                  }
                                  className="accent-[var(--gold)]"
                                />
                                Assembly
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(stop.localId, it.localId)
                                }
                                className="ml-auto text-[var(--red)]"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addPickup}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brd)] px-3 py-2 text-[11px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
        >
          <Plus size={14} /> Add pickup stop
        </button>
        <button
          type="button"
          onClick={addDropoff}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brd)] px-3 py-2 text-[11px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
        >
          <Plus size={14} /> Add dropoff stop
        </button>
      </div>
      <p className="text-[10px] text-[var(--tx3)]">
        Total stops: {stops.length} ({pickupCount} pickup
        {pickupCount !== 1 ? "s" : ""} + {dropCount} delivery
        {dropCount !== 1 ? " drops" : ""})
      </p>
    </div>
  );
}
