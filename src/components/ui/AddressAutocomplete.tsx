"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface GoogleMapsAutocompleteInstance {
  addListener(event: string, fn: () => void): void;
  getPlace(): GooglePlaceResult;
}

declare global {
  namespace google {
    namespace maps {
      namespace places {
        type Autocomplete = GoogleMapsAutocompleteInstance;
      }
    }
  }
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, opts?: { componentRestrictions?: { country: string }; types?: string[]; bounds?: unknown; fields?: string[] }) => GoogleMapsAutocompleteInstance;
        };
        LatLngBounds: new (sw: { lat: number; lng: number }, ne: { lat: number; lng: number }) => unknown;
      };
    };
  }
}

interface GooglePlaceResult {
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  formatted_address?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
}

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
}

function getComponent(place: GooglePlaceResult, type: string, short = false): string {
  const comp = place.address_components?.find((c) => c.types.includes(type));
  if (!comp) return "";
  return short ? (comp.short_name || "") : (comp.long_name || "");
}

function parsePlace(place: GooglePlaceResult): AddressResult | null {
  if (!place.address_components || place.address_components.length === 0) return null;
  const streetNumber = getComponent(place, "street_number");
  const route = getComponent(place, "route");
  const streetName = [streetNumber, route].filter(Boolean).join(" ").trim() || route || streetNumber;
  const unit = getComponent(place, "subpremise") ? `Unit ${getComponent(place, "subpremise")}` : "";
  const city = getComponent(place, "locality") || getComponent(place, "sublocality") || getComponent(place, "administrative_area_level_2");
  const province = getComponent(place, "administrative_area_level_1", true);
  const postalCode = getComponent(place, "postal_code");
  const country = getComponent(place, "country");
  const fullAddress = place.formatted_address || [streetName, unit, city, province, postalCode, country].filter(Boolean).join(", ");
  const lat = place.geometry?.location?.lat?.() ?? 0;
  const lng = place.geometry?.location?.lng?.() ?? 0;
  return {
    fullAddress,
    streetNumber,
    streetName: streetName || fullAddress,
    unit,
    city,
    province,
    postalCode,
    country,
    lat,
    lng,
  };
}

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
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isScriptReady, setScriptReady] = useState(false);
  const isInternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);
  const onRawChangeRef = useRef(onRawChange);
  onChangeRef.current = onChange;
  onRawChangeRef.current = onRawChange;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.maps?.places) {
      setScriptReady(true);
      return;
    }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com"][src*="places"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          setScriptReady(true);
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  // Sync input when value changes from parent (e.g. loading edit data, form reset)
  useEffect(() => {
    if (inputRef.current && !isInternalUpdate.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
    isInternalUpdate.current = false;
  }, [value]);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["address_components", "formatted_address", "geometry"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const result = parsePlace(place);
      if (result) {
        if (inputRef.current) inputRef.current.value = result.fullAddress;
        isInternalUpdate.current = true;
        onChangeRef.current(result);
        onRawChangeRef.current?.(result.fullAddress);
      }
    });
    autocompleteRef.current = autocomplete;
  }, []);

  useEffect(() => {
    if (!isScriptReady) return;
    // Delay init so input is visible (fixes modals where input mounts when popup opens)
    const t = setTimeout(() => {
      initAutocomplete();
    }, 150);
    return () => {
      clearTimeout(t);
      autocompleteRef.current = null;
    };
  }, [isScriptReady, initAutocomplete]);

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all " +
    (className || "");

  return (
    <div className="w-full">
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
        onChange={(e) => {
          onRawChange?.(e.target.value);
        }}
        placeholder={placeholder}
        required={required}
        className={inputClass}
        id={id}
        name={name}
        autoComplete="off"
      />
    </div>
  );
}
