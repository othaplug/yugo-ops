"use client";

/** HTML string for Leaflet divIcon - animated crew location marker */
export function getTruckIconHtml(size = 36): string {
  const svgSize = Math.round(size * 0.55);
  return `<div class="truck-marker-animated" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#C9A962,#8B7332);border:2px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.35);"><svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/></svg></div>`;
}

/** Animated crew location marker for live tracking */
export function TruckMarker({ className = "", size = 40 }: { className?: string; size?: number }) {
  const svgSize = size * 0.5;
  return (
    <div
      className={`truck-marker-animated ${className}`}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #C9A962, #8B7332)",
        border: "2px solid white",
        borderRadius: "50%",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" fill="white" stroke="none" />
      </svg>
    </div>
  );
}
