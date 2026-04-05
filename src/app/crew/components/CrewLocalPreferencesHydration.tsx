"use client";

import { useEffect } from "react";

const CREW_SETTINGS_KEY = "yugo-crew-settings";

/**
 * Applies legacy crew settings from localStorage (reduce motion / low data)
 * when no settings UI exists — keeps prior behaviour for returning devices.
 */
export default function CrewLocalPreferencesHydration() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CREW_SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { reduceMotion?: boolean; lowDataMode?: boolean };
      if (s.reduceMotion === true) document.documentElement.setAttribute("data-reduce-motion", "true");
      if (s.reduceMotion === false) document.documentElement.removeAttribute("data-reduce-motion");
      if (s.lowDataMode === true) document.documentElement.setAttribute("data-low-data", "true");
      if (s.lowDataMode === false) document.documentElement.removeAttribute("data-low-data");
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
