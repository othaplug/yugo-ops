"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  ReactNode,
} from "react";
import {
  applyDocumentDarkTheme,
  applyDocumentLightTheme,
} from "@/lib/document-theme-tokens";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined,
);

export function ThemeProvider({
  children,
  lockTheme,
}: {
  children: ReactNode;
  /** Crew portal: always light; do not persist or read `yugo-theme` so admin prefs stay independent. */
  lockTheme?: "light";
}) {
  /** Admin default is light; persisted `yugo-theme` (light | dark) overrides after mount. */
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    if (lockTheme === "light") {
      setThemeState("light");
      return;
    }
    const saved = localStorage.getItem("yugo-theme") as Theme;
    if (saved === "dark") setThemeState("dark");
    else if (saved === "light") setThemeState("light");
    /* missing or invalid key → keep light */
  }, [lockTheme]);

  useLayoutEffect(() => {
    if (lockTheme === "light") {
      applyDocumentLightTheme();
      return;
    }
    if (theme === "light") {
      applyDocumentLightTheme();
    } else {
      applyDocumentDarkTheme();
    }
  }, [theme, lockTheme]);

  useEffect(() => {
    if (lockTheme !== "light") {
      localStorage.setItem("yugo-theme", theme);
      /* Keep in sync with AdminShell (legacy yu3.theme) so [data-yugo-admin-v3] tokens match document */
      try {
        localStorage.setItem("yu3.theme", theme);
      } catch {
        /* ignore */
      }
    }
  }, [theme, lockTheme]);

  const toggleTheme = () => {
    if (lockTheme === "light") return;
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };
  const setTheme = (newTheme: Theme) => {
    if (lockTheme === "light") return;
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
