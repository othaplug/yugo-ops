"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("yugo-theme") as Theme;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    if (theme === "light") {
      root.setProperty("--bg", "#F5F5F2");
      root.setProperty("--bg2", "#FFF");
      root.setProperty("--card", "#FFF");
      root.setProperty("--tx", "#1A1A1A");
      root.setProperty("--tx2", "#555");
      root.setProperty("--tx3", "#999");
      root.setProperty("--brd", "#E0DDD8");
    } else {
      root.setProperty("--bg", "#0F0F0F");
      root.setProperty("--bg2", "#1A1A1A");
      root.setProperty("--card", "#1E1E1E");
      root.setProperty("--tx", "#E8E5E0");
      root.setProperty("--tx2", "#999");
      root.setProperty("--tx3", "#666");
      root.setProperty("--brd", "#2A2A2A");
    }
    localStorage.setItem("yugo-theme", theme);
  }, [theme]);

  const toggleTheme = () => setThemeState(prev => prev === "dark" ? "light" : "dark");
  const setTheme = (newTheme: Theme) => setThemeState(newTheme);

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