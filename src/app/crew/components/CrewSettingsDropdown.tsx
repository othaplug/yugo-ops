"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/app/admin/components/ThemeContext";

const CREW_SETTINGS_KEY = "yugo-crew-settings";

type CrewSettings = {
  reduceMotion?: boolean;
  lowDataMode?: boolean;
};

function getCrewSettings(): CrewSettings {
  if (typeof window === "undefined") return {};
  try {
    const s = localStorage.getItem(CREW_SETTINGS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function setCrewSettings(settings: CrewSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CREW_SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.setAttribute("data-reduce-motion", settings.reduceMotion ? "true" : "false");
    document.documentElement.setAttribute("data-low-data", settings.lowDataMode ? "true" : "false");
  } catch {}
}

export default function CrewSettingsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const [settings, setSettingsState] = useState<CrewSettings>(() => getCrewSettings());

  useEffect(() => {
    const stored = getCrewSettings();
    setSettingsState(stored);
    document.documentElement.setAttribute("data-reduce-motion", stored.reduceMotion ? "true" : "false");
    document.documentElement.setAttribute("data-low-data", stored.lowDataMode ? "true" : "false");
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const updateSetting = <K extends keyof CrewSettings>(key: K, value: CrewSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettingsState(next);
    setCrewSettings(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="size-9 flex items-center justify-center rounded-lg text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)] transition-colors"
        aria-label="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(260px,calc(100vw-2rem))] bg-[var(--bg2)] border border-[var(--brd)] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-up">
          <div className="px-4 py-3 border-b border-[var(--brd)]">
            <h3 className="text-[12px] font-semibold text-[var(--tx)]">Settings</h3>
          </div>

          <div className="py-2">
            <div className="px-4 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-2">Appearance</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-[var(--tx2)]">Theme</span>
                <div className="flex rounded-lg border border-[var(--brd)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${theme === "light" ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${theme === "dark" ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-2">Optimisation</div>
              <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
                <span className="text-[12px] text-[var(--tx2)]">Reduce motion</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.reduceMotion}
                  onClick={() => updateSetting("reduceMotion", !settings.reduceMotion)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${settings.reduceMotion ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.reduceMotion ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
                <span className="text-[12px] text-[var(--tx2)]">Low data mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.lowDataMode}
                  onClick={() => updateSetting("lowDataMode", !settings.lowDataMode)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${settings.lowDataMode ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.lowDataMode ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--brd)]">
            <form action="/api/crew/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[11px] font-medium text-[var(--red)] hover:bg-[var(--rdim)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
