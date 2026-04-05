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
  const [theme, setThemeState] = useState<Theme>(lockTheme === "light" ? "light" : "dark");

  useEffect(() => {
    if (lockTheme === "light") {
      setThemeState("light");
      return;
    }
    const saved = localStorage.getItem("yugo-theme") as Theme;
    if (saved === "light" || saved === "dark") setThemeState(saved);
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
