"use client";

/**
 * MultiStopAddressField
 *
 * Wraps one or more AddressAutocomplete inputs for a single direction
 * (pickup OR dropoff). The first address is the "primary" stop; additional
 * stops can be added with the + button and removed with the × button.
 *
 * Usage:
 *   <MultiStopAddressField
 *     label="From"
 *     placeholder="Pick-up address"
 *     stops={fromStops}
 *     onChange={setFromStops}
 *   />
 */

import { useCallback, type ReactNode } from "react";
import { Plus, X } from "@phosphor-icons/react";
import AddressAutocomplete, { type AddressResult } from "./AddressAutocomplete";

export interface StopEntry {
  address: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  label: string;
  placeholder?: string;
  stops: StopEntry[];
  onChange: (stops: StopEntry[]) => void;
  maxStops?: number;
  disabled?: boolean;
  inputClassName?: string;
  /** Overrides default “Add another …” link text */
  addStopButtonText?: string;
  /** Hide the visible "FROM" / "TO" caption (use placeholder + screen reader only) */
  labelVisibility?: "visible" | "sr-only";
  /**
   * Renders beside the first address only (e.g. access select), aligned on one row so
   * underlines match the first input.
   */
  trailingOnFirstRow?: ReactNode;
}

export default function MultiStopAddressField({
  label,
  placeholder,
  stops,
  onChange,
  maxStops = 5,
  disabled = false,
  inputClassName,
  addStopButtonText,
  labelVisibility = "visible",
  trailingOnFirstRow,
}: Props) {
  const updateStop = useCallback(
    (index: number, result: AddressResult) => {
      const next = stops.map((s, i) =>
        i === index ? { address: result.fullAddress, lat: result.lat ?? null, lng: result.lng ?? null } : s
      );
      onChange(next);
    },
    [stops, onChange]
  );

  const updateStopRaw = useCallback(
    (index: number, address: string) => {
      const next = stops.map((s, i) =>
        i === index ? { ...s, address } : s
      );
      onChange(next);
    },
    [stops, onChange]
  );

  const addStop = useCallback(() => {
    if (stops.length >= maxStops) return;
    onChange([...stops, { address: "", lat: null, lng: null }]);
  }, [stops, onChange, maxStops]);

  const removeStop = useCallback(
    (index: number) => {
      // Never remove the primary (index 0)
      if (index === 0 || stops.length <= 1) return;
      onChange(stops.filter((_, i) => i !== index));
    },
    [stops, onChange]
  );

  return (
    <div className="space-y-1.5">
      {labelVisibility === "sr-only" ? (
        <span className="sr-only">
          {label} address{label === "From" || label === "To" ? "" : ""}
        </span>
      ) : (
        <span className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
          {label}
        </span>
      )}

      {stops.map((stop, index) => {
        if (index === 0 && trailingOnFirstRow) {
          return (
            <div
              key={index}
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
            >
              <div className="relative min-w-0 flex-1">
                <AddressAutocomplete
                  value={stop.address}
                  onChange={(result) => updateStop(index, result)}
                  onRawChange={(raw) => updateStopRaw(index, raw)}
                  placeholder={placeholder ?? label}
                  disabled={disabled}
                  className={inputClassName}
                />
              </div>
              <div className="w-full shrink-0 sm:w-[11rem] sm:max-w-[13rem]">{trailingOnFirstRow}</div>
            </div>
          );
        }
        return (
          <div key={index} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              {index > 0 && (
                <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <span className="text-[10px] font-bold text-[#492A1D]">+{index}</span>
                </div>
              )}
              <AddressAutocomplete
                value={stop.address}
                onChange={(result) => updateStop(index, result)}
                onRawChange={(raw) => updateStopRaw(index, raw)}
                placeholder={index === 0 ? (placeholder ?? label) : `Additional ${label.toLowerCase()} address`}
                disabled={disabled}
                className={
                  index > 0
                    ? `field-input--leading ${inputClassName ?? ""}`.trim()
                    : inputClassName
                }
              />
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeStop(index)}
                disabled={disabled}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5C5853] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
                title="Remove this stop"
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}

      {stops.length < maxStops && !disabled && (
        <button
          type="button"
          onClick={addStop}
          className="mt-3 flex w-full items-center justify-start gap-1 text-left text-[11px] font-medium text-[var(--tx3)] transition-colors hover:text-[var(--tx2)]"
        >
          <Plus size={11} weight="bold" className="shrink-0 opacity-80" aria-hidden />
          <span className="underline-offset-2 hover:underline">
            {addStopButtonText ?? `Add another ${label.toLowerCase()} address`}
          </span>
        </button>
      )}
    </div>
  );
}
