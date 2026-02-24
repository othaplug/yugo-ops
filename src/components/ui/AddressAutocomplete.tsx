"use client";

import { useRef, useEffect, useState, useCallback } from "react";

export interface AddressResult {
  fullAddress: string;
  streetNumber: string;
  streetName: string;
  unit: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (address: AddressResult) => void;
  onRawChange?: (text: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  /** ISO 3166-1 alpha-2 country code to bias results (e.g. "CA") */
  country?: string;
}

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  text: string;
  place_name: string;
  geometry: { type: string; coordinates: [number, number] };
  context?: { id: string; text: string; short_code?: string }[];
  properties?: Record<string, unknown>;
}

function mapboxFeatureToAddressResult(f: MapboxFeature): AddressResult {
  const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
  const ctx = f.context ?? [];
  const getCtx = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text ?? "";
  const getCtxShort = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.short_code ?? "";

  const country = getCtx("country.") || getCtxShort("country.") || "";
  const province = getCtx("region.") || getCtxShort("region.") || "";
  const postalCode = getCtx("postcode.") || "";
  const city = getCtx("place.") || getCtx("locality.") || "";
  const fullAddress = f.place_name || f.text || "";

  // Mapbox often has "address" type with text = street name; no separate street_number
  const streetName = f.place_type?.includes("address") ? (f.text || fullAddress) : fullAddress;

  return {
    fullAddress,
    streetNumber: "",
    streetName: streetName || fullAddress,
    unit: "",
    city,
    province,
    postalCode,
    country,
    lat,
    lng,
  };
}

const DEBOUNCE_MS = 280;

export default function AddressAutocomplete({
  value,
  onChange,
  onRawChange,
  placeholder = "Enter address",
  label,
  required,
  className = "",
  id,
  name,
  country: countryBias = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const isInternalUpdate = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (countryBias) params.set("country", countryBias);
      const res = await fetch(`/api/mapbox/geocode?${params}`);
      const data = await res.json();
      setSuggestions((data.features ?? []) as MapboxFeature[]);
      setHighlightIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [countryBias]);

  useEffect(() => {
    if (isInternalUpdate.current) return;
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
    isInternalUpdate.current = false;
  }, [value]);

  useEffect(() => {
    const handle = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const raw = inputRef.current?.value?.trim() ?? "";
      onRawChange?.(raw);
      if (raw.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(raw);
        setOpen(true);
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    };

    const input = inputRef.current;
    if (!input) return;
    input.addEventListener("input", handle);
    input.addEventListener("focus", () => suggestions.length > 0 && setOpen(true));
    return () => {
      input.removeEventListener("input", handle);
      input.removeEventListener("focus", () => {});
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchSuggestions, suggestions.length, onRawChange]);

  useEffect(() => {
    const onBlur = () => {
      setTimeout(() => setOpen(false), 180);
    };
    const input = inputRef.current;
    input?.addEventListener("blur", onBlur);
    return () => input?.removeEventListener("blur", onBlur);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const select = useCallback(
    (f: MapboxFeature) => {
      const result = mapboxFeatureToAddressResult(f);
      if (inputRef.current) {
        inputRef.current.value = result.fullAddress;
        isInternalUpdate.current = true;
      }
      setSuggestions([]);
      setOpen(false);
      onChange(result);
      onRawChange?.(result.fullAddress);
    },
    [onChange, onRawChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i < suggestions.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Enter" && highlightIdx >= 0 && suggestions[highlightIdx]) {
      e.preventDefault();
      select(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all " +
    (className || "");

  return (
    <div ref={containerRef} className="w-full relative">
      {label && (
        <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">
          {label}
          {required && <span className="text-[var(--red)] ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        className={inputClass}
        id={id}
        name={name}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="address-suggestions"
        role="combobox"
      />
      {open && (suggestions.length > 0 || loading) && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-[100] left-0 right-0 mt-1 py-1 rounded-lg border border-[var(--brd)] bg-[var(--card)] shadow-lg max-h-[280px] overflow-y-auto"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-[var(--tx3)]">Searching...</li>
          ) : (
            suggestions.map((f, i) => (
              <li
                key={f.id}
                role="option"
                aria-selected={i === highlightIdx}
                className={`px-3 py-2.5 text-[13px] cursor-pointer transition-colors ${
                  i === highlightIdx ? "bg-[var(--gold)]/15 text-[var(--tx)]" : "text-[var(--tx2)] hover:bg-[var(--bg)]"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(f);
                }}
              >
                {f.place_name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
