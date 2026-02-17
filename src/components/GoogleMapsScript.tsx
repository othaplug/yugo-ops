"use client";

import Script from "next/script";

const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GoogleMapsScript() {
  if (!key || key.trim() === "") return null;
  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`}
      strategy="lazyOnload"
    />
  );
}
