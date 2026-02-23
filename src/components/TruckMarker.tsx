"use client";

/** HTML string for Leaflet divIcon - animated truck marker */
export function getTruckIconHtml(size = 36): string {
  const svgSize = Math.round(size * 0.55);
  return `<div class="truck-marker-animated" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#C9A962,#8B7332);border:2px solid white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.35);"><svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>`;
}

/** Animated truck marker for live tracking - Uber-style moving vehicle indicator */
export function TruckMarker({ className = "", size = 40 }: { className?: string; size?: number }) {
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
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
          fill="white"
        />
      </svg>
    </div>
  );
}
