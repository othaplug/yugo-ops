"use client";

import { useTheme } from "../components/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
      <div>
        <div className="text-[13px] font-semibold text-[var(--tx)]">Theme</div>
        <div className="text-[11px] text-[var(--tx3)] mt-0.5">Light or dark mode</div>
      </div>
      <button
        onClick={toggleTheme}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          theme === "dark" ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            theme === "dark" ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
