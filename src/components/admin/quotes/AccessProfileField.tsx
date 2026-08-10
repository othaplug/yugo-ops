"use client";

import * as React from "react";
import {
  ACCESS_TYPE_SPECS,
  accessModelFromProfile,
  defaultProfile,
  fieldValueAsString,
  specForType,
  type AccessFieldSpec,
  type AccessProfile,
  type AccessPropertyType,
} from "@/lib/buildings/access-profile";

const TYPE_ICON: Record<AccessPropertyType, React.ReactNode> = {
  house: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 11l9-7 9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" />
    </svg>
  ),
  town: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 20V8l4-3 4 3v12" /><path d="M12 20V10l4-2 4 2v10" /><path d="M7 12h.01M7 16h.01" />
    </svg>
  ),
  condo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" />
    </svg>
  ),
  walkup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 20h4v-4h4v-4h4v-4h4" />
    </svg>
  ),
  ground: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 20h18" /><path d="M6 20V9h6v11" /><path d="M12 20V13h6v7" />
    </svg>
  ),
};

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

export function AccessProfileField({
  value,
  onChange,
  endLabel,
}: {
  value: AccessProfile | null;
  onChange: (p: AccessProfile) => void;
  endLabel: string;
}) {
  const model = value ? accessModelFromProfile(value) : null;
  const spec = value ? specForType(value.property_type) : null;

  return (
    <div className="rounded-xl border border-[var(--ln)] bg-[var(--bg1)] p-3 sm:p-4">
      <div className="mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--tx3)]">
          {endLabel} access
        </span>
      </div>

      {/* property type chips */}
      <div className="flex flex-wrap gap-2">
        {ACCESS_TYPE_SPECS.map((t) => {
          const on = value?.property_type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(defaultProfile(t.key))}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${
                on
                  ? "border-[var(--wine)] bg-[var(--wine-tint)] text-[var(--wine)]"
                  : "border-[var(--ln)] bg-[var(--bg2)] text-[var(--tx1)] hover:border-[var(--wine)]"
              }`}
              aria-pressed={on}
            >
              <span className="h-4 w-4 shrink-0">{TYPE_ICON[t.key]}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {value && spec ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
          {/* fields */}
          <div className="flex flex-col gap-3">
            {spec.fields.map((f) => {
              const cur = fieldValueAsString(value, f);
              return (
                <div key={String(f.key)}>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tx3)]">
                    {f.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.options.map(([v, l]) => {
                      const on = cur === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onChange(setField(value, f, v))}
                          className={`rounded-md border px-2.5 py-1.5 text-[13px] transition ${
                            on
                              ? "border-[var(--wine)] bg-[var(--wine)] text-white"
                              : "border-[var(--ln)] bg-[var(--bg2)] text-[var(--tx1)] hover:border-[var(--wine)]"
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
          </div>

          {/* readout */}
          {model ? (
            <div className="rounded-lg border border-[var(--ln)] bg-[var(--bg2)] p-3">
              <div className="text-[12px] font-semibold text-[var(--tx1)]">
                What the crew &amp; engine see
              </div>
              <div className="mt-2 flex items-baseline justify-between border-b border-dashed border-[var(--ln)] pb-2">
                <span className="text-[12px] text-[var(--tx3)]">Extra time / trip</span>
                <span className="text-[16px] font-semibold tabular-nums text-[var(--tx1)]">
                  +{model.estimatedExtraMinutesPerTrip} min
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12px] text-[var(--tx3)]">Complexity</span>
                <span className="text-[12px] font-semibold text-[var(--tx1)]">
                  {CX_LABEL[model.complexityRating]} · {model.complexityRating}/5
                </span>
              </div>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-sm ${
                      i <= model.complexityRating
                        ? "bg-[var(--wine)]"
                        : "bg-[var(--ln)]"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    model.recommendExtraCrew
                      ? "bg-[var(--forest-tint)] text-[var(--forest)]"
                      : "bg-[var(--bg1)] text-[var(--tx3)]"
                  }`}
                >
                  {model.recommendExtraCrew ? "+1 mover at this end" : "Standard crew"}
                </span>
              </div>
              {model.drivers.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {model.drivers.map((d) => (
                    <li
                      key={d.key}
                      className="flex justify-between text-[12px] text-[var(--tx3)]"
                    >
                      <span>{d.label}</span>
                      <span className="font-semibold tabular-nums text-[var(--tx1)]">
                        +{d.minutesPerTrip} min
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {model.schedulingFlags.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  {model.schedulingFlags.map((fl) => (
                    <div
                      key={fl.key}
                      className="rounded-md bg-[var(--amber-tint)] px-2.5 py-1.5 text-[12px] text-[var(--amber)]"
                    >
                      {fl.label}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[13px] italic text-[var(--tx3)]">
          Pick a property type to capture access.
        </p>
      )}
    </div>
  );
}
