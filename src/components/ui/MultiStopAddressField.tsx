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

import { useCallback } from "react";
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
}

export default function MultiStopAddressField({
  label,
  placeholder,
  stops,
  onChange,
  maxStops = 5,
  disabled = false,
  inputClassName,
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
      <label className="block text-[11px] font-semibold text-[var(--tx3)] capitalize tracking-wide">
        {label}
      </label>

      {stops.map((stop, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="flex-1 relative">
            {index > 0 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <span className="text-[10px] font-bold text-[#C9A962]">+{index}</span>
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
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#5C5853] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
              title="Remove this stop"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      {stops.length < maxStops && !disabled && (
        <button
          type="button"
          onClick={addStop}
          className="flex items-center gap-1 text-[11px] text-[#C9A962] hover:text-[#b8953d] font-semibold transition-colors mt-0.5"
        >
          <Plus size={11} weight="bold" />
          Add another {label.toLowerCase()} address
        </button>
      )}
    </div>
  );
}
