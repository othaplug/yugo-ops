"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type VariantCell = { price?: number; mount_model?: string };
type VariantCfg = {
  sizes?: Record<string, { label?: string; types?: Record<string, VariantCell> }>;
};

export type AddonCatalogItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  price_type: string;
  unit_label: string | null;
  tiers: { label?: string; price: number; bins?: number }[] | null;
  variant_config: VariantCfg | null;
  excluded_tiers: string[] | null;
};

const TIER_ALIASES: Record<string, string[]> = {
  essential: ["essential", "curated", "essentials"],
  signature: ["signature", "premier"],
  estate: ["estate"],
};

function isExcludedForTier(item: AddonCatalogItem, tier: string | null): boolean {
  if (!tier || !item.excluded_tiers?.length) return false;
  const aliases = TIER_ALIASES[tier] ?? [tier];
  return item.excluded_tiers.some((t) => aliases.includes(t));
}

export default function AddAddonModule({
  moveId,
  catalog,
  moveTier,
  hasCardOnFile,
}: {
  moveId: string;
  catalog: AddonCatalogItem[];
  moveTier: string | null;
  hasCardOnFile: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addonId, setAddonId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [tierIndex, setTierIndex] = useState(0);
  const [variantSize, setVariantSize] = useState("");
  const [variantType, setVariantType] = useState("");
  const [chargeNow, setChargeNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Add-ons the current tier already includes for free are not chargeable, so
  // hide them from the picker to prevent a confusing "nothing to add" error.
  const selectable = useMemo(
    () => catalog.filter((a) => !isExcludedForTier(a, moveTier)),
    [catalog, moveTier],
  );

  const selected = selectable.find((a) => a.id === addonId) ?? null;
  const sizes = selected?.variant_config?.sizes ?? {};
  const sizeKeys = Object.keys(sizes);
  const typeKeys = variantSize ? Object.keys(sizes[variantSize]?.types ?? {}) : [];

  function reset() {
    setAddonId("");
    setQuantity(1);
    setTierIndex(0);
    setVariantSize("");
    setVariantType("");
    setChargeNow(false);
  }

  async function submit() {
    if (!selected) return;
    setMsg(null);
    setSubmitting(true);
    try {
      const bodyBase: Record<string, unknown> = {
        addon_id: selected.id,
        quantity,
        charge_now: chargeNow,
      };
      if (selected.price_type === "tiered") bodyBase.tier_index = tierIndex;
      if (selected.price_type === "variant_matrix") {
        if (!variantSize || !variantType) {
          setMsg({ kind: "err", text: "Pick the TV size and mount type." });
          setSubmitting(false);
          return;
        }
        bodyBase.variants = [{ size: variantSize, type: variantType, quantity }];
        bodyBase.quantity = 1;
      }
      const res = await fetch(`/api/admin/moves/${moveId}/add-addon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyBase),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "Could not add the add-on." });
        setSubmitting(false);
        return;
      }
      const priceStr = `$${Number(data.pre_tax).toFixed(2)}`;
      setMsg({
        kind: "ok",
        text:
          data.mode === "charged"
            ? `${data.addon} added and charged (${priceStr} + HST).`
            : `${data.addon} added (${priceStr} + HST). Balance is now $${Number(data.new_balance).toFixed(2)}, collected with the balance.`,
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error, try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--yu3-line-subtle)] bg-[var(--yu3-surface)] px-3 py-2 text-sm text-[var(--yu3-ink-base)]";

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMsg(null);
          }}
          className="text-xs font-semibold text-[var(--yu3-accent,#66143D)] hover:underline"
        >
          + Add an add-on
        </button>
      ) : (
        <div className="rounded-xl border border-[var(--yu3-line-subtle)] p-3 space-y-3">
          <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--yu3-ink-muted)]">
            Add an add-on
          </div>

          <select
            value={addonId}
            onChange={(e) => {
              setAddonId(e.target.value);
              setTierIndex(0);
              setVariantSize("");
              setVariantType("");
              setQuantity(1);
            }}
            className={inputCls}
          >
            <option value="">Select an add-on…</option>
            {selectable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {selected && (selected.price_type === "per_unit") && (
            <label className="block text-xs text-[var(--yu3-ink-muted)]">
              Quantity{selected.unit_label ? ` (${selected.unit_label})` : ""}
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputCls} mt-1`}
              />
            </label>
          )}

          {selected && selected.price_type === "tiered" && selected.tiers && (
            <label className="block text-xs text-[var(--yu3-ink-muted)]">
              Option
              <select
                value={tierIndex}
                onChange={(e) => setTierIndex(Number(e.target.value))}
                className={`${inputCls} mt-1`}
              >
                {selected.tiers.map((t, i) => (
                  <option key={i} value={i}>
                    {t.label ?? (t.bins != null ? `${t.bins} bins` : `Option ${i + 1}`)} (${t.price})
                  </option>
                ))}
              </select>
            </label>
          )}

          {selected && selected.price_type === "variant_matrix" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-[var(--yu3-ink-muted)]">
                Size
                <select
                  value={variantSize}
                  onChange={(e) => {
                    setVariantSize(e.target.value);
                    setVariantType("");
                  }}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Size…</option>
                  {sizeKeys.map((s) => (
                    <option key={s} value={s}>
                      {(sizes[s]?.label ?? s).replace(/\s*[—–]\s*/g, "-")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--yu3-ink-muted)]">
                Mount
                <select
                  value={variantType}
                  onChange={(e) => setVariantType(e.target.value)}
                  disabled={!variantSize}
                  className={`${inputCls} mt-1`}
                >
                  <option value="">Mount…</option>
                  {typeKeys.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                      {sizes[variantSize]?.types?.[t]?.price != null
                        ? ` ($${sizes[variantSize]?.types?.[t]?.price})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--yu3-ink-base)]">
            <input
              type="checkbox"
              checked={chargeNow}
              disabled={!hasCardOnFile}
              onChange={(e) => setChargeNow(e.target.checked)}
            />
            Charge the card on file now
            {!hasCardOnFile ? (
              <span className="text-[var(--yu3-ink-muted)]">(no card on file)</span>
            ) : null}
          </label>
          {!chargeNow && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              Added to the move total and collected with the balance 48h before the move.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!selected || submitting}
              className="rounded-lg bg-[var(--yu3-accent,#66143D)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Adding…" : chargeNow ? "Add and charge" : "Add to move"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
                setMsg(null);
              }}
              className="text-xs text-[var(--yu3-ink-muted)] hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`mt-2 text-xs ${
            msg.kind === "ok" ? "text-[var(--yu3-ink-base)]" : "text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
