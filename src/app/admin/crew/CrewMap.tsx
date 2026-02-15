"use client";

import { useEffect, useRef, useState } from "react";
import ModalOverlay from "../components/ModalOverlay";

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
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  useEffect(() => {
    if (!mapRef.current || loaded) return;

    // Load leaflet CSS via link tag
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Dynamic import — only runs in browser
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, { zoomControl: false }).setView([43.665, -79.385], 13);
      (map.getContainer() as HTMLElement).style.zIndex = "1";

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
      <div className="mb-4">
        <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Live Crew Tracking</h2>
        <p className="text-[11px] text-[var(--tx3)] mt-0.5">Click a team for details</p>
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 relative z-0">
        <div
          ref={mapRef}
          className="w-full rounded-lg border border-[var(--brd)] relative z-0"
          style={{ height: 380 }}
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {crews.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCrew(c)}
            className="flex items-center gap-3 px-4 py-3.5 bg-[var(--card)] border border-[var(--brd)] rounded-xl hover:border-[var(--gold)] transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[var(--gold)] bg-[var(--gdim)] group-hover:bg-[var(--gold)]/20 transition-colors">
              {c.name?.replace("Team ", "")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[var(--tx)]">{c.name}</div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">{(c.members || []).join(", ")}</div>
              <div className="text-[9px] text-[var(--tx2)] mt-0.5">{c.status === "en-route" ? `En route • ${c.current_job}` : c.current_job || "Standby"}</div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.status === "en-route" ? "bg-[var(--org)] animate-pulse" : "bg-[var(--grn)]"}`} />
          </button>
        ))}
      </div>

      <ModalOverlay open={!!selectedCrew} onClose={() => setSelectedCrew(null)} title={selectedCrew?.name || ""} maxWidth="sm">
        {selectedCrew && (
          <div className="p-5 space-y-4">
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</div>
              <div className={`text-[13px] font-semibold ${selectedCrew.status === "en-route" ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
                {selectedCrew.status === "en-route" ? "En route" : "Standby"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Current Job</div>
              <div className="text-[13px] text-[var(--tx)]">{selectedCrew.current_job || "No active job"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team Members</div>
              <div className="flex flex-wrap gap-2">
                {(selectedCrew.members || []).map((m) => (
                  <span key={m} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModalOverlay>
    </>
  );
}