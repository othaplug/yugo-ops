"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CrewGPSPage() {
  const [crewId, setCrewId] = useState("");
  const [status, setStatus] = useState("Select your crew");
  const [tracking, setTracking] = useState(false);
  const supabase = createClient();

  const startTracking = () => {
    if (!crewId) return;
    setTracking(true);
    setStatus("Tracking active...");

    // Send location every 30 seconds
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          await supabase
            .from("crews")
            .update({
              current_lat: latitude,
              current_lng: longitude,
              status: "en-route",
              updated_at: new Date().toISOString(),
            })
            .eq("id", crewId);

          setStatus(`📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)} — sent`);
        },
        (err) => setStatus(`GPS error: ${err.message}`),
        { enableHighAccuracy: true }
      );
    };

    sendLocation();
    const interval = setInterval(sendLocation, 30000);

    return () => clearInterval(interval);
  };

  const [crews, setCrews] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("crews").select("id, name, members");
      setCrews(data || []);
    };
    load();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="font-serif text-lg tracking-[2px]">YUGO</div>
          <div className="text-[8px] font-bold text-[#C9A962] tracking-wider">CREW TRACKING</div>
        </div>

        <select
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
          className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded text-sm"
        >
          <option value="">Select your crew...</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {(c.members || []).join(", ")}
            </option>
          ))}
        </select>

        {!tracking ? (
          <button
            onClick={startTracking}
            disabled={!crewId}
            className="w-full p-3 bg-[#C9A962] text-black font-semibold rounded disabled:opacity-50"
          >
            Start Tracking
          </button>
        ) : (
          <button
            onClick={() => { setTracking(false); setStatus("Stopped"); }}
            className="w-full p-3 bg-red-600 text-white font-semibold rounded"
          >
            Stop Tracking
          </button>
        )}

        <div className="text-center text-[10px] text-zinc-500">{status}</div>

        {tracking && (
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mx-auto animate-pulse" />
            <div className="text-[9px] text-green-500 mt-1">Live — updating every 30s</div>
          </div>
        )}
      </div>
    </main>
  );
}