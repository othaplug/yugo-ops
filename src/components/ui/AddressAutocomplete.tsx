"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useAdminShellTheme } from "@/hooks/useAdminShellTheme";

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
  /**
   * Mapbox `proximity` as { lng, lat }. Biases suggestion ranking toward that area.
   * Omit for Greater Toronto default. Pass `null` for no proximity (neutral ranking in the allowed countries).
   */
  mapProximity?: { lng: number; lat: number } | null;
  disabled?: boolean;
  /** Match design-system admin v3 field chrome */
  variant?: "yu3" | "default";
  /** Fired when the text input blurs, with the current input value (e.g. save draft address). */
  onInputBlur?: (value: string) => void;
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

/**
 * Replace the full state/province name in a Mapbox place_name string with its abbreviation.
 * Searches right-to-left so "New York, New York 10036" correctly abbreviates the state segment.
 * Mapbox short_code format: "CA-ON", "US-NY" — we extract just the trailing abbreviation.
 */
function abbreviateRegionInPlaceName(
  placeName: string,
  regionName: string,
  regionShortCode: string
): string {
  const abbr = regionShortCode.includes("-")
    ? regionShortCode.split("-").slice(1).join("-")
    : regionShortCode;
  if (!abbr || abbr === regionName) return placeName;

  const parts = placeName.split(",");
  for (let i = parts.length - 1; i >= 0; i--) {
    const trimmed = parts[i].trim();
    if (trimmed === regionName || trimmed.startsWith(regionName + " ")) {
      parts[i] = parts[i].replace(regionName, abbr);
      break;
    }
  }
  return parts.join(",");
}

/** Format a Mapbox place_name for display: abbreviate state/province and strip country for CA. */
function formatAddressForDisplay(
  placeName: string,
  country: string,
  regionName = "",
  regionShortCode = ""
): string {
  let out = (placeName || "").trim();
  if (!out) return out;

  // Abbreviate state/province (e.g. "Ontario" → "ON", "New York" → "NY")
  if (regionName && regionShortCode) {
    out = abbreviateRegionInPlaceName(out, regionName, regionShortCode);
  }

  // For Canadian addresses, omit "Canada" suffix
  const c = country.trim();
  if (c !== "Canada" && c !== "CA") return out;
  out = out.replace(/,?\s*Canada\s*$/i, "").replace(/,?\s*CA\s*$/i, "").trim();
  return out.replace(/,+\s*$/, "").trim() || placeName;
}

function mapboxFeatureToAddressResult(f: MapboxFeature): AddressResult {
  const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
  const ctx = f.context ?? [];
  const getCtx = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text ?? "";
  const getCtxShort = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.short_code ?? "";

  const country = getCtx("country.") || getCtxShort("country.") || "";
  const regionName = getCtx("region.");
  const regionShortCode = getCtxShort("region.");
  const province = regionName || regionShortCode || "";
  const postalCode = getCtx("postcode.") || "";
  const city = getCtx("place.") || getCtx("locality.") || "";
  const rawPlaceName = f.place_name || f.text || "";
  const fullAddress = formatAddressForDisplay(rawPlaceName, country, regionName, regionShortCode);

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

/** Downtown Toronto: default Mapbox `proximity` so Canadian addresses rank near operations area first. */
const DEFAULT_MAP_PROXIMITY_TORONTO = { lng: -79.3832, lat: 43.6532 } as const;

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
  mapProximity,
  disabled,
  variant = "default",
  onInputBlur,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; maxHeight?: number; above?: boolean } | null>(null);
  const isInternalUpdate = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onRawChangeRef = useRef(onRawChange);
  onRawChangeRef.current = onRawChange;
  const listboxId = useId();
  const adminShellTheme = useAdminShellTheme();

  const updateDropdownRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const showAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    if (showAbove) {
      const maxH = Math.min(280, spaceAbove);
      setDropdownRect({ top: rect.top - maxH - 4, left: rect.left, width: rect.width, maxHeight: maxH, above: true });
    } else {
      const maxH = Math.min(280, Math.max(120, spaceBelow));
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: maxH, above: false });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setDropdownRect(null);
      return;
    }
    updateDropdownRect();
  }, [open, updateDropdownRect]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updateDropdownRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateDropdownRect]);

  const resolvedProximity =
    mapProximity === null ? null : mapProximity ?? DEFAULT_MAP_PROXIMITY_TORONTO;

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (countryBias) params.set("country", countryBias);
      if (resolvedProximity) {
        params.set("proximity", `${resolvedProximity.lng},${resolvedProximity.lat}`);
      }
      const res = await fetch(`/api/mapbox/geocode?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        console.warn("[AddressAutocomplete] geocode failed:", res.status, data?.error ?? data);
        setSuggestions([]);
        setHighlightIdx(-1);
        return;
      }
      setSuggestions((data.features ?? []) as MapboxFeature[]);
      setHighlightIdx(-1);
    } catch (e) {
      console.warn("[AddressAutocomplete] geocode error:", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [countryBias, resolvedProximity]);

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
    isInternalUpdate.current = false;
  }, [value]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const scheduleFetchFromInput = useCallback(
    (openAfter: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const raw = inputRef.current?.value ?? "";
      onRawChangeRef.current?.(raw);
      const q = raw.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void fetchSuggestions(q);
        if (openAfter) setOpen(true);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions]
  );

  const handleInput = () => {
    scheduleFetchFromInput(true);
  };

  const handleFocus = () => {
    const q = inputRef.current?.value?.trim() ?? "";
    if (q.length >= 2) {
      void fetchSuggestions(q);
      setOpen(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 180);
    const v = inputRef.current?.value ?? "";
    onInputBlur?.(v);
  };

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

  const boxedFallback =
    "w-full px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--brd)] focus:ring-0 outline-none transition-all";
  const yu3FieldClass =
    "w-full h-9 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-3 text-[13px] text-[var(--yu3-ink-strong)] placeholder:text-[var(--yu3-ink-faint)] transition-colors duration-[var(--yu3-dur-1)] hover:border-[var(--yu3-line-strong)] focus:outline-none focus:ring-0 focus:border-[var(--yu3-line)] disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass = className.trim()
    ? className.trim()
    : variant === "yu3"
      ? yu3FieldClass
      : boxedFallback;

  return (
    <div ref={containerRef} className="w-full relative">
      {label && (
        <label
          className={
            variant === "yu3"
              ? "mb-1.5 block yu3-t-eyebrow text-[var(--yu3-ink-muted)]"
              : "mb-1 block text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]"
          }
        >
          {label}
          {required && (
            <span
              className={variant === "yu3" ? "ml-0.5 text-[var(--yu3-danger)]" : "ml-0.5 text-[var(--red)]"}
              aria-hidden
            >
              *
            </span>
          )}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        className={inputClass}
        id={id}
        name={name}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        role="combobox"
      />
      {open && (suggestions.length > 0 || loading) && dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            id={listboxId}
            role="listbox"
            {...(variant === "yu3"
              ? { "data-yugo-admin-v3": "", "data-theme": adminShellTheme }
              : {})}
            className={
              variant === "yu3"
                ? "fixed overflow-y-auto rounded-[var(--yu3-r-md,8px)] border border-[var(--yu3-line,#d4cdbb)] bg-[var(--yu3-bg-surface,#ffffff)] py-1 text-[var(--yu3-ink,#24201d)] shadow-lg"
                : "fixed overflow-y-auto rounded-lg border border-[var(--brd)] bg-[var(--card)] py-1 shadow-lg"
            }
            style={{
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight ?? 280,
              /* Above GlobalModal (--z-modal 99990); below toasts (--z-toast) */
              zIndex: "var(--z-modal-dropdown, 99995)",
              boxShadow: dropdownRect.above
                ? "0 -4px 20px rgba(0,0,0,0.12)"
                : "0 4px 20px rgba(0,0,0,0.12)",
            }}
          >
            {loading && suggestions.length === 0 ? (
              <li
                className={
                  variant === "yu3"
                    ? "px-3 py-2 text-[12px] text-[var(--yu3-ink-muted)]"
                    : "px-3 py-2 text-[12px] text-[var(--tx3)]"
                }
              >
                Searching...
              </li>
            ) : (
              suggestions.map((f, i) => {
                const ctx = f.context ?? [];
                const getCtx = (prefix: string) => ctx.find((c: { id: string; text?: string; short_code?: string }) => c.id.startsWith(prefix))?.text ?? "";
                const getCtxShort = (prefix: string) => ctx.find((c: { id: string; text?: string; short_code?: string }) => c.id.startsWith(prefix))?.short_code ?? "";
                const country = getCtx("country.") || getCtxShort("country.") || "";
                const regionName = getCtx("region.");
                const regionShortCode = getCtxShort("region.");
                const displayText = formatAddressForDisplay(f.place_name || f.text || "", country, regionName, regionShortCode);
                return (
                  <li
                    key={f.id}
                    role="option"
                    aria-selected={i === highlightIdx}
                    className={
                      variant === "yu3"
                        ? `cursor-pointer px-3 py-2.5 text-[13px] transition-colors ${
                            i === highlightIdx
                              ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-ink-strong)]"
                              : "text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)]"
                          }`
                        : `cursor-pointer px-3 py-2.5 text-[13px] transition-colors ${
                            i === highlightIdx
                              ? "bg-[var(--gold)]/15 text-[var(--tx)]"
                              : "text-[var(--tx2)] hover:bg-[var(--bg)]"
                          }`
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(f);
                    }}
                  >
                    {displayText}
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
