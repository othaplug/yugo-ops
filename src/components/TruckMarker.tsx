"use client";

import { Truck } from "@phosphor-icons/react";

/** Animated crew location marker for live tracking */
export function TruckMarker({ className = "", size = 40 }: { className?: string; size?: number }) {
  const iconSize = Math.round(size * 0.5);
  return (
    <div
      className={`truck-marker-animated ${className}`}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2C3E2D, #8B7332)",
        border: "2px solid white",
        borderRadius: "50%",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <Truck size={iconSize} color="#fff" aria-hidden />
    </div>
  );
}
