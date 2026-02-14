"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";



interface Crew {
  id: string;
  name: string;
  members: string[];
  status: string;
  current_lat: number;
  current_lng: number;
  current_job: string;
}

export default function CrewMap({ crews }: { crews: Crew[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || loaded) return;

    // Dynamic import — only runs in browser
    import("leaflet").then((L) => {

      const map = L.map(mapRef.current!, { zoomControl: false }).setView([43.665, -79.385], 13);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      crews.forEach((c) => {
        if (!c.current_lat || !c.current_lng) return;
        const label = c.name?.replace("Team ", "") || "?";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#C9A962,#8B7332);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([c.current_lat, c.current_lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${c.name}</b><br>${(c.members || []).join(", ")}<br><em>${c.current_job || "Standby"}</em>`);
      });

      setLoaded(true);
    });
  }, [crews, loaded]);

  return (
    <>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-3">
        <div
          ref={mapRef}
          className="w-full rounded-lg border border-[var(--brd)]"
          style={{ height: 350 }}
        />
      </div>
      <div className="flex flex-col gap-1">
        {crews.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-[var(--gold)] bg-[var(--gdim)]">
              {c.name?.replace("Team ", "")}
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold">{c.name} — {(c.members || []).join(", ")}</div>
              <div className="text-[9px] text-[var(--tx3)]">{c.status === "en-route" ? `En route • ${c.current_job}` : c.current_job || "Standby"}</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${c.status === "en-route" ? "bg-[var(--org)]" : "bg-[var(--grn)]"}`} />
          </div>
        ))}
      </div>
    </>
  );
}