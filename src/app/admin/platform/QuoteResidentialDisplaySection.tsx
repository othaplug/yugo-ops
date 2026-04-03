"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import { ListBullets, TextAa, Trash, Plus, CaretDown } from "@phosphor-icons/react";
import {
  mergeResidentialTierMetaFromConfig,
  parseResidentialTierFeaturesStorage,
  expandResidentialTierFeaturesStorage,
  tierFeaturesStorageEqualToDefaults,
  DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE,
  tierMetaFormFromMerged,
  tierMetaEqualToDefaults,
  serializeTierMetaOverrides,
  parseAdminTierMetaJson,
  MIN_TIER_FEATURE_ROWS,
  MIN_SIGNATURE_ESTATE_ADDITION_ROWS,
  parseAdminTierFeaturesJson,
  type ResidentialTierFeaturesStorage,
} from "@/lib/quotes/residential-tier-quote-display";
import { TIER_ORDER } from "@/app/quote/[quoteId]/quote-shared";
import type { TierFeature } from "@/app/quote/[quoteId]/quote-shared";

const TIER_TABS: { id: (typeof TIER_ORDER)[number]; label: string }[] = [
  { id: "essential", label: "Essential" },
  { id: "signature", label: "Signature" },
  { id: "estate", label: "Estate" },
];

const EMPTY_ROW: TierFeature = {
  card: "New feature line",
  title: "New feature line",
  desc: "Short description for expanded quote section",
  iconName: "CheckCircle",
};

function cloneStorage(s: ResidentialTierFeaturesStorage): ResidentialTierFeaturesStorage {
  return JSON.parse(JSON.stringify(s)) as ResidentialTierFeaturesStorage;
}

function editorRowsForTier(s: ResidentialTierFeaturesStorage, tier: (typeof TIER_ORDER)[number]): TierFeature[] {
  if (tier === "essential") return s.essential;
  if (tier === "signature") {
    return Array.isArray(s.signature) ? s.signature : s.signature.additions;
  }
  return Array.isArray(s.estate) ? s.estate : s.estate.additions;
}

function isLegacyFullTier(s: ResidentialTierFeaturesStorage, tier: "signature" | "estate"): boolean {
  return Array.isArray(s[tier]);
}

interface Props {
  initialTierFeaturesJson: string;
  initialTierMetaOverridesJson: string;
}

export default function QuoteResidentialDisplaySection({
  initialTierFeaturesJson,
  initialTierMetaOverridesJson,
}: Props) {
  const { toast } = useToast();
  const [storage, setStorage] = useState<ResidentialTierFeaturesStorage>(() =>
    parseResidentialTierFeaturesStorage(initialTierFeaturesJson),
  );
  const [activeTier, setActiveTier] = useState<(typeof TIER_ORDER)[number]>("essential");
  const [tierMetaForm, setTierMetaForm] = useState(() =>
    tierMetaFormFromMerged(mergeResidentialTierMetaFromConfig(initialTierMetaOverridesJson)),
  );
  const [saving, setSaving] = useState(false);
  const [jsonAdvanced, setJsonAdvanced] = useState("");
  const [jsonAdvancedError, setJsonAdvancedError] = useState<string | null>(null);
  const [metaJsonAdvanced, setMetaJsonAdvanced] = useState("");
  const [metaJsonAdvancedError, setMetaJsonAdvancedError] = useState<string | null>(null);

  useEffect(() => {
    setStorage(parseResidentialTierFeaturesStorage(initialTierFeaturesJson));
    setTierMetaForm(tierMetaFormFromMerged(mergeResidentialTierMetaFromConfig(initialTierMetaOverridesJson)));
  }, [initialTierFeaturesJson, initialTierMetaOverridesJson]);

  const syncJsonAdvancedFromModel = useCallback((s: ResidentialTierFeaturesStorage) => {
    setJsonAdvanced(JSON.stringify(s, null, 2));
    setJsonAdvancedError(null);
  }, []);

  const minRowsForActiveTier = (): number => {
    if (activeTier === "essential") return MIN_TIER_FEATURE_ROWS;
    if (isLegacyFullTier(storage, activeTier)) return MIN_TIER_FEATURE_ROWS;
    return MIN_SIGNATURE_ESTATE_ADDITION_ROWS;
  };

  const removeRow = (tier: (typeof TIER_ORDER)[number], index: number) => {
    setStorage((prev) => {
      const next = cloneStorage(prev);
      if (tier === "essential") {
        const list = next.essential;
        if (list.length <= MIN_TIER_FEATURE_ROWS) return prev;
        next.essential = list.filter((_, i) => i !== index);
        return next;
      }
      if (tier === "signature") {
        if (Array.isArray(next.signature)) {
          const list = next.signature;
          if (list.length <= MIN_TIER_FEATURE_ROWS) return prev;
          next.signature = list.filter((_, i) => i !== index);
        } else {
          const list = next.signature.additions;
          if (list.length <= MIN_SIGNATURE_ESTATE_ADDITION_ROWS) return prev;
          next.signature = { additions: list.filter((_, i) => i !== index) };
        }
        return next;
      }
      if (Array.isArray(next.estate)) {
        const list = next.estate;
        if (list.length <= MIN_TIER_FEATURE_ROWS) return prev;
        next.estate = list.filter((_, i) => i !== index);
      } else {
        const list = next.estate.additions;
        if (list.length <= MIN_SIGNATURE_ESTATE_ADDITION_ROWS) return prev;
        next.estate = { additions: list.filter((_, i) => i !== index) };
      }
      return next;
    });
  };

  const addRow = (tier: (typeof TIER_ORDER)[number]) => {
    setStorage((prev) => {
      const next = cloneStorage(prev);
      const row = { ...EMPTY_ROW };
      if (tier === "essential") {
        next.essential = [...next.essential, row];
        return next;
      }
      if (tier === "signature") {
        if (Array.isArray(next.signature)) {
          next.signature = [...next.signature, row];
        } else {
          next.signature = { additions: [...next.signature.additions, row] };
        }
        return next;
      }
      if (Array.isArray(next.estate)) {
        next.estate = [...next.estate, row];
      } else {
        next.estate = { additions: [...next.estate.additions, row] };
      }
      return next;
    });
  };

  const updateRow = (tier: (typeof TIER_ORDER)[number], index: number, patch: Partial<TierFeature>) => {
    setStorage((prev) => {
      const next = cloneStorage(prev);
      const mapList = (list: TierFeature[]) => list.map((r, i) => (i === index ? { ...r, ...patch } : r));
      if (tier === "essential") {
        next.essential = mapList(next.essential);
        return next;
      }
      if (tier === "signature") {
        if (Array.isArray(next.signature)) {
          next.signature = mapList(next.signature);
        } else {
          next.signature = { additions: mapList(next.signature.additions) };
        }
        return next;
      }
      if (Array.isArray(next.estate)) {
        next.estate = mapList(next.estate);
      } else {
        next.estate = { additions: mapList(next.estate.additions) };
      }
      return next;
    });
  };

  const convertToAdditiveLists = () => {
    setStorage((prev) => {
      const full = expandResidentialTierFeaturesStorage(prev);
      return {
        essential: [...prev.essential],
        signature: { additions: full.signature.slice(prev.essential.length) },
        estate: { additions: full.estate.slice(full.signature.length) },
      };
    });
    toast("Signature & Estate now use shorter “plus” lists on the quote", "check");
  };

  const updateTierMeta = (
    tier: (typeof TIER_ORDER)[number],
    patch: { tagline?: string; footer?: string; inclusionsIntro?: string },
  ) => {
    setTierMetaForm((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], ...patch },
    }));
  };

  const applyMetaJsonAdvanced = () => {
    const result = parseAdminTierMetaJson(metaJsonAdvanced, tierMetaForm);
    if (!result.ok) {
      setMetaJsonAdvancedError(result.error);
      return;
    }
    setTierMetaForm(result.value);
    setMetaJsonAdvancedError(null);
    toast("Applied JSON to tagline and best-for fields", "check");
  };

  const applyJsonAdvanced = () => {
    const trimmed = jsonAdvanced.trim();
    if (!trimmed) {
      setJsonAdvancedError("JSON cannot be empty");
      return;
    }
    const result = parseAdminTierFeaturesJson(trimmed);
    if (!result.ok) {
      setJsonAdvancedError(result.error);
      return;
    }
    setStorage(result.value);
    setJsonAdvancedError(null);
    toast("Applied JSON to feature lists", "check");
  };

  const persist = async () => {
    const tierFeaturesPayload = tierFeaturesStorageEqualToDefaults(storage)
      ? ""
      : JSON.stringify(storage, null, 2);
    const tierMetaPayload = tierMetaEqualToDefaults(tierMetaForm) ? "" : serializeTierMetaOverrides(tierMetaForm);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/quote-display-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tierFeaturesJson: tierFeaturesPayload, tierMetaOverridesJson: tierMetaPayload }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Save failed", "x");
        return;
      }
      toast("Client quote tier copy saved", "check");
    } catch {
      toast("Save failed", "x");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5";
  const inputCls =
    "w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)]/50";
  const ta =
    "w-full min-h-[180px] px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg font-mono text-[11px] leading-relaxed text-[var(--tx)] outline-none focus:border-[var(--gold)]/50";

  const list = editorRowsForTier(storage, activeTier);
  const showConvert = isLegacyFullTier(storage, "signature") || isLegacyFullTier(storage, "estate");

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <ListBullets className="w-[14px] h-[14px]" aria-hidden />
          Client quote — residential tiers
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1 max-w-2xl">
          <strong className="font-semibold text-[var(--tx)]">Essential</strong> is the full list.{" "}
          <strong className="font-semibold text-[var(--tx)]">Signature</strong> and{" "}
          <strong className="font-semibold text-[var(--tx)]">Estate</strong> use{" "}
          <strong className="font-semibold text-[var(--tx)]">only extra lines</strong> shown after “Everything in Essential /
          Signature, plus:” on tier cards (shorter cards). The expanded “Your move includes” section still shows the full merged
          list. First two lines on each tier are still replaced on the live quote by truck and crew from the quote data.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-5">
        {showConvert ? (
          <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--tx2)] max-w-xl">
              Config uses full Signature/Estate arrays (legacy). Convert to additive storage to match the shorter tier cards.
            </p>
            <button
              type="button"
              onClick={convertToAdditiveLists}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[11px] font-semibold hover:opacity-90"
            >
              Convert to “plus” lists
            </button>
          </div>
        ) : null}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <label className={labelCls}>Tier feature lines</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                onClick={() => setStorage(cloneStorage(DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE))}
              >
                Reset lists to built-in defaults
              </button>
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg)] border border-[var(--brd)] mb-3 w-fit">
            {TIER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTier(tab.id)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  activeTier === tab.id
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                    : "text-[var(--tx2)] hover:text-[var(--tx)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTier !== "essential" && !isLegacyFullTier(storage, activeTier) ? (
            <p className="text-[10px] text-[var(--tx3)] mb-3 max-w-2xl">
              Edit only lines that are <strong className="text-[var(--tx2)]">not</strong> already covered by the lower tier.
              Wording for “Everything in … plus:” is under Tier card copy → Inclusions intro.
            </p>
          ) : null}

          <ul className="space-y-2">
            {list.map((row, index) => (
              <li
                key={`${activeTier}-${index}`}
                className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-[var(--tx3)] w-6 shrink-0 pt-2">{index + 1}</span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Card bullet</label>
                      <input
                        type="text"
                        value={row.card}
                        onChange={(e) => updateRow(activeTier, index, { card: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <details className="group">
                      <summary className="text-[10px] font-semibold text-[var(--gold)] cursor-pointer list-none flex items-center gap-1">
                        <CaretDown className="w-3 h-3 group-open:rotate-180 transition-transform" aria-hidden />
                        Title, description, icon
                      </summary>
                      <div className="mt-2 space-y-2 pl-0.5">
                        <div>
                          <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Title</label>
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) => updateRow(activeTier, index, { title: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Description</label>
                          <textarea
                            value={row.desc}
                            onChange={(e) => updateRow(activeTier, index, { desc: e.target.value })}
                            rows={2}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Icon name</label>
                          <input
                            type="text"
                            value={row.iconName}
                            onChange={(e) => updateRow(activeTier, index, { iconName: e.target.value })}
                            className={inputCls}
                            placeholder="e.g. Truck, ShieldCheck"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(activeTier, index)}
                    disabled={list.length <= minRowsForActiveTier()}
                    title={
                      list.length <= minRowsForActiveTier()
                        ? activeTier === "essential" || isLegacyFullTier(storage, activeTier as "signature" | "estate")
                          ? `At least ${MIN_TIER_FEATURE_ROWS} lines required`
                          : "At least one line or leave empty list"
                        : "Remove this line"
                    }
                    className="shrink-0 p-2 rounded-lg border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--red)] hover:border-[var(--red)]/40 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label={`Remove feature ${index + 1}`}
                  >
                    <Trash className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => addRow(activeTier)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            Add line to {TIER_TABS.find((t) => t.id === activeTier)?.label}
          </button>

          <div className="mt-6 pt-5 border-t border-[var(--brd)]/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={`${labelCls} flex items-center gap-1.5 mb-0`}>
                <TextAa className="w-3.5 h-3.5" aria-hidden />
                Tier card copy ({TIER_TABS.find((t) => t.id === activeTier)?.label})
              </label>
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                onClick={() => setTierMetaForm(tierMetaFormFromMerged(mergeResidentialTierMetaFromConfig("")))}
                title="Restore tagline, best-for, and inclusions intros to built-in defaults for all tiers"
              >
                Reset all tiers to built-in card copy
              </button>
            </div>
            <p className="text-[10px] text-[var(--tx3)]">
              Shown on the client quote tier cards. The &quot;Best for&quot; line is stored as the footer; include the words{" "}
              <span className="text-[var(--tx2)]">Best for:</span> if you want them to appear.
            </p>
            <div>
              <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Tagline</label>
              <textarea
                value={tierMetaForm[activeTier].tagline}
                onChange={(e) => updateTierMeta(activeTier, { tagline: e.target.value })}
                rows={2}
                className={inputCls}
                aria-label={`Tagline for ${activeTier} tier`}
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Best for</label>
              <textarea
                value={tierMetaForm[activeTier].footer}
                onChange={(e) => updateTierMeta(activeTier, { footer: e.target.value })}
                rows={2}
                className={inputCls}
                placeholder='e.g. Best for: simple, well-prepared moves.'
                aria-label={`Best for line for ${activeTier} tier`}
              />
            </div>
            {(activeTier === "signature" || activeTier === "estate") && (
              <div>
                <label className="text-[9px] font-bold uppercase text-[var(--tx3)]">Inclusions intro</label>
                <input
                  type="text"
                  value={tierMetaForm[activeTier].inclusionsIntro}
                  onChange={(e) => updateTierMeta(activeTier, { inclusionsIntro: e.target.value })}
                  className={inputCls}
                  placeholder={
                    activeTier === "signature" ? "Everything in Essential, plus:" : "Everything in Signature, plus:"
                  }
                  aria-label={`Inclusions intro for ${activeTier} tier`}
                />
                <p className="text-[9px] text-[var(--tx3)] mt-1">
                  Line above the Signature/Estate-only bullet list (additive cards).
                </p>
              </div>
            )}
          </div>
        </div>

        <details
          className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3"
          onToggle={(e) => {
            const el = e.currentTarget;
            if (el.open) syncJsonAdvancedFromModel(storage);
          }}
        >
          <summary className="text-[11px] font-semibold text-[var(--tx)] cursor-pointer">
            Advanced: edit all tiers as JSON
          </summary>
          <p className="text-[10px] text-[var(--tx3)] mt-2 mb-2">
            <code className="text-[9px]">essential</code> is a full array.{" "}
            <code className="text-[9px]">signature</code> / <code className="text-[9px]">estate</code> may be{" "}
            <code className="text-[9px]">{`{ "additions": [ ... ] }`}</code> (shorter cards) or a full array (legacy).
          </p>
          <textarea
            value={jsonAdvanced}
            onChange={(e) => {
              setJsonAdvanced(e.target.value);
              setJsonAdvancedError(null);
            }}
            className={ta}
            spellCheck={false}
            aria-label="Tier features JSON"
          />
          {jsonAdvancedError ? (
            <p className="text-[11px] text-[var(--red)] mt-2">{jsonAdvancedError}</p>
          ) : null}
          <button
            type="button"
            onClick={applyJsonAdvanced}
            className="mt-2 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
          >
            Apply JSON to lists above
          </button>
        </details>

        <details
          className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3"
          onToggle={(e) => {
            const el = e.currentTarget;
            if (el.open) {
              setMetaJsonAdvanced(serializeTierMetaOverrides(tierMetaForm));
              setMetaJsonAdvancedError(null);
            }
          }}
        >
          <summary className="text-[11px] font-semibold text-[var(--tx)] cursor-pointer">
            Advanced: tagline &amp; best-for as JSON (all tiers)
          </summary>
          <p className="text-[10px] text-[var(--tx3)] mt-2 mb-2">
            Optional. Include <code className="text-[9px]">inclusionsIntro</code> on signature/estate for the “plus” line.
          </p>
          <textarea
            value={metaJsonAdvanced}
            onChange={(e) => {
              setMetaJsonAdvanced(e.target.value);
              setMetaJsonAdvancedError(null);
            }}
            className={ta}
            spellCheck={false}
            aria-label="Tier meta overrides JSON"
          />
          {metaJsonAdvancedError ? (
            <p className="text-[11px] text-[var(--red)] mt-2">{metaJsonAdvancedError}</p>
          ) : null}
          <button
            type="button"
            onClick={applyMetaJsonAdvanced}
            className="mt-2 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
          >
            Apply JSON to fields above
          </button>
        </details>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={persist}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save quote tier copy"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStorage(parseResidentialTierFeaturesStorage(""));
              setTierMetaForm(tierMetaFormFromMerged(mergeResidentialTierMetaFromConfig("")));
              setJsonAdvanced("");
              setJsonAdvancedError(null);
              setMetaJsonAdvanced("");
              setMetaJsonAdvancedError(null);
            }}
            className="px-4 py-2.5 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] hover:border-[var(--gold)]"
          >
            Clear overrides (use code defaults)
          </button>
        </div>
      </div>
    </section>
  );
}
