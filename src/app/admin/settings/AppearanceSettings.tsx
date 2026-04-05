"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../components/ThemeContext";
import { useToast } from "../components/Toast";
import { Check } from "@phosphor-icons/react";

const DEFAULT_PAGES = [
  { value: "/admin", label: "Command Center (Dashboard)" },
  { value: "/admin/moves", label: "All Moves" },
  { value: "/admin/dispatch", label: "Dispatch Board" },
  { value: "/admin/calendar", label: "Calendar" },
  { value: "/admin/quotes", label: "Quotes" },
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY  (e.g. 03/13/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY  (e.g. 13/03/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD  (e.g. 2026-03-13)" },
  { value: "MMM D, YYYY", label: "MMM D, YYYY  (e.g. Mar 13, 2026)" },
];

const FONT_SIZES = [
  { value: "compact", label: "Compact: smaller text, tighter spacing" },
  { value: "default", label: "Default: standard sizing" },
  { value: "comfortable", label: "Comfortable: slightly larger text" },
];

function load(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [defaultPage, setDefaultPage] = useState("/admin");
  const [density, setDensity] = useState("default");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDateFormat(load("pref_date_format", "MM/DD/YYYY"));
    setTimeFormat(load("pref_time_format", "12h"));
    setDefaultPage(load("pref_default_page", "/admin"));
    setDensity(load("pref_density", "default"));
    setSidebarCollapsed(load("pref_sidebar_collapsed", "false") === "true");
  }, []);

  const handleSave = () => {
    localStorage.setItem("pref_date_format", dateFormat);
    localStorage.setItem("pref_time_format", timeFormat);
    localStorage.setItem("pref_default_page", defaultPage);
    localStorage.setItem("pref_density", density);
    localStorage.setItem("pref_sidebar_collapsed", String(sidebarCollapsed));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast("Appearance preferences saved", "check");
  };

  const fieldClass =
    "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors";

  const Row = ({
    label,
    desc,
    children,
  }: {
    label: string;
    desc?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--brd)] last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--tx)]">
          {label}
        </div>
        {desc && (
          <div className="text-[10px] text-[var(--tx3)] mt-0.5">{desc}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h3 className="text-[13px] font-bold text-[var(--tx)]">Theme</h3>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5">
            Choose how the dashboard looks
          </p>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                theme === t
                  ? "border-[var(--gold)] bg-[var(--gold)]/5"
                  : "border-[var(--brd)] hover:border-[var(--gold)]/40"
              }`}
            >
              {t === "light" ? (
                <div className="w-12 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center">
                  <div className="w-6 h-1.5 rounded bg-gray-300" />
                </div>
              ) : (
                <div className="w-12 h-8 rounded-md bg-[#111113] border border-[#2a2a2e] flex items-center justify-center">
                  <div className="w-6 h-1.5 rounded bg-[#3a3a3e]" />
                </div>
              )}
              <span
                className={`text-[11px] font-semibold uppercase ${theme === t ? "text-[var(--gold)]" : "text-[var(--tx2)]"}`}
              >
                {t} Mode
              </span>
              {theme === t && (
                <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[var(--admin-primary-fill)] flex items-center justify-center">
                  <Check weight="bold" size={8} color="#fff" aria-hidden />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Display Preferences */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h3 className="text-[13px] font-bold text-[var(--tx)]">
            Display Preferences
          </h3>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5">
            Date, time, and layout formatting
          </p>
        </div>
        <div className="px-5 py-1">
          <Row
            label="Date Format"
            desc="How dates are displayed across the dashboard"
          >
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[11px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            >
              {DATE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.value}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Time Format" desc="12-hour or 24-hour clock">
            <div className="flex rounded-lg border border-[var(--brd)] overflow-hidden text-[11px] font-semibold">
              {(["12h", "24h"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeFormat(t)}
                  className={`px-3 py-1.5 transition-colors ${timeFormat === t ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row
            label="Text Density"
            desc="Controls spacing and text size throughout the app"
          >
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[11px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            >
              {FONT_SIZES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label.split(":")[0]}
                </option>
              ))}
            </select>
          </Row>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h3 className="text-[13px] font-bold text-[var(--tx)]">Navigation</h3>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5">
            Sidebar and default landing page
          </p>
        </div>
        <div className="px-5 py-1">
          <Row label="Default Page" desc="Where you land after signing in">
            <select
              value={defaultPage}
              onChange={(e) => setDefaultPage(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[11px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            >
              {DEFAULT_PAGES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Row>
          <Row
            label="Collapse Sidebar by Default"
            desc="Start with the sidebar minimized on load"
          >
            <Toggle
              checked={sidebarCollapsed}
              onChange={() => setSidebarCollapsed((v) => !v)}
            />
          </Row>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all"
      >
        {saved ? "Saved ✓" : "Save Preferences"}
      </button>
    </div>
  );
}
