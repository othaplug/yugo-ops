"use client";

import * as React from "react";
import {
  ACCESS_TYPE_SPECS,
  accessModelFromProfile,
  defaultProfile,
  fieldValueAsString,
  profileToBuildingBody,
  specForType,
  type AccessFieldSpec,
  type AccessProfile,
  type AccessPropertyType,
} from "@/lib/buildings/access-profile";

const CX_LABEL = ["", "Very easy", "Easy", "Moderate", "Hard", "Very hard"];

function setField(
  profile: AccessProfile,
  f: AccessFieldSpec,
  raw: string,
): AccessProfile {
  const next: AccessProfile = { ...profile };
  if (f.boolean) (next as Record<string, unknown>)[f.key] = raw === "1";
  else if (f.numeric) (next as Record<string, unknown>)[f.key] = Number(raw);
  else (next as Record<string, unknown>)[f.key] = raw;
  return next;
}

/** Property types that live in a multi-unit building and need a unit/suite number. */
const UNIT_BEARING_TYPES: AccessPropertyType[] = ["condo", "walkup"];

export function AccessProfileField({
  value,
  onChange,
  endLabel,
  address,
  unit,
  onUnitChange,
}: {
  value: AccessProfile | null;
  onChange: (p: AccessProfile) => void;
  endLabel: string;
  address?: string;
  /** Unit / suite number for this address (shown for condo / walk-up). */
  unit?: string;
  onUnitChange?: (v: string) => void;
}) {
  const model = value ? accessModelFromProfile(value) : null;
  const spec = value ? specForType(value.property_type) : null;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveAsBuilding() {
    if (!value || !address?.trim()) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileToBuildingBody(value, address.trim())),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-3">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--tx3)]">
        {endLabel} access
      </span>

      {/* property type — slim pills, no chrome */}
      <div className="flex flex-wrap gap-1.5">
        {ACCESS_TYPE_SPECS.map((t) => {
          const on = value?.property_type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(defaultProfile(t.key))}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] leading-none transition ${
                on
                  ? "border-transparent bg-[var(--admin-primary-fill)] font-medium text-[var(--btn-text-on-accent)]"
                  : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--admin-primary-fill)] hover:text-[var(--tx)]"
              }`}
              aria-pressed={on}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Unit / suite — only for multi-unit buildings (condo / walk-up). */}
      {value && onUnitChange && UNIT_BEARING_TYPES.includes(value.property_type) ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <label
            htmlFor={`access-unit-${endLabel}`}
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--tx3)]"
          >
            Unit / Suite
          </label>
          <input
            id={`access-unit-${endLabel}`}
            type="text"
            value={unit ?? ""}
            onChange={(e) => onUnitChange(e.target.value)}
            placeholder="e.g. 1201"
            className="w-28 rounded-md border border-[var(--brd)] bg-[var(--bg2)] px-2.5 py-1.5 text-[13px] text-[var(--tx)] outline-none transition focus:border-[var(--admin-primary-fill)]"
            aria-label={`${endLabel} unit or suite number`}
          />
          <span className="text-[11px] text-[var(--tx3)]">shown on quote, crew sheet &amp; tracking</span>
        </div>
      ) : null}

      {value && spec ? (
        <div className="space-y-2.5 pt-0.5">
          {/* each question: label left, options inline (hidden factors keep their default) */}
          {spec.fields.filter((f) => !f.hidden).map((f) => {
            const cur = fieldValueAsString(value, f);
            return (
              <div key={String(f.key)} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="w-full text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--tx3)] sm:w-[104px] sm:shrink-0">
                  {f.label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {f.options.map(([v, l]) => {
                    const on = cur === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onChange(setField(value, f, v))}
                        className={`rounded-full border px-2.5 py-1 text-[12px] leading-none transition ${
                          on
                            ? "border-transparent bg-[var(--admin-primary-fill)] font-medium text-[var(--btn-text-on-accent)]"
                            : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--admin-primary-fill)] hover:text-[var(--tx)]"
                        }`}
                        aria-pressed={on}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* readout — one compact strip */}
          {model ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                <span className="tabular-nums font-semibold text-[var(--tx)]">
                  +{model.estimatedExtraMinutesPerTrip}<span className="ml-0.5 font-normal text-[var(--tx3)]">min / trip</span>
                </span>
                <span className="h-3 w-px bg-[var(--brd)]" aria-hidden />
                <span className="inline-flex items-center gap-1.5 text-[var(--tx3)]">
                  {CX_LABEL[model.complexityRating]}
                  <span className="flex gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1 w-3 rounded-sm ${
                          i <= model.complexityRating ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"
                        }`}
                      />
                    ))}
                  </span>
                </span>
                <span className="h-3 w-px bg-[var(--brd)]" aria-hidden />
                <span className={model.recommendExtraCrew ? "font-medium text-[var(--grn)]" : "text-[var(--tx3)]"}>
                  {model.recommendExtraCrew ? "+1 mover" : "Standard crew"}
                </span>
              </div>
              {model.drivers.length > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--tx3)]">
                  {model.drivers.map((d) => (
                    <span key={d.key}>
                      {d.label} <span className="font-semibold tabular-nums text-[var(--tx)]">+{d.minutesPerTrip}m</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {model.schedulingFlags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {model.schedulingFlags.map((fl) => (
                    <span
                      key={fl.key}
                      className="rounded bg-[var(--ordim)] px-2 py-0.5 text-[11px] text-[var(--org)]"
                    >
                      {fl.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--tx3)]">Pick a property type to capture access.</p>
      )}

      {value && address?.trim() ? (
        <div className="flex items-center gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={saveAsBuilding}
            disabled={saveState === "saving" || saveState === "saved"}
            className="text-[11px] font-semibold text-[var(--admin-primary-fill)] underline-offset-2 hover:underline disabled:opacity-60 disabled:no-underline"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved to buildings"
                : "Save as building profile"}
          </button>
          {saveState === "error" ? (
            <span className="text-[11px] text-[var(--org)]">Could not save, try again</span>
          ) : (
            <span className="text-[11px] text-[var(--tx3)]">reuse on future quotes</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
