"use client";

import { useState, useRef, useEffect } from "react";
import { Gear, SignOut } from "@phosphor-icons/react";
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
        <Gear size={20} />
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
                  className={`crew-keep-round relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.reduceMotion ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.reduceMotion ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
                <span className="text-[12px] text-[var(--tx2)]">Low data mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.lowDataMode}
                  onClick={() => updateSetting("lowDataMode", !settings.lowDataMode)}
                  className={`crew-keep-round relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings.lowDataMode ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.lowDataMode ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--brd)]">
            <form action="/api/crew/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2.5 w-full px-4 py-2 text-[11px] font-medium text-[var(--red)] hover:bg-[var(--rdim)] transition-colors"
              >
                <SignOut size={14} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
