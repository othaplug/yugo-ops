"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined,
);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("yugo-theme") as Theme;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const root = document.documentElement.style;
    if (theme === "light") {
      /* Match partner light mode: warm off-white/beige palette */
      root.setProperty("--bg", "#FAF8F5");
      root.setProperty("--bg2", "#F5F3F0");
      root.setProperty("--card", "#FFFFFF");
      root.setProperty("--tx", "#1A1A1A");
      root.setProperty("--tx2", "#333333");
      root.setProperty("--tx3", "#524D47");
      root.setProperty("--brd", "#E8E4DF");
      root.setProperty("--gdim", "rgba(201,169,98,0.2)");
      root.setProperty("--btn-text-on-accent", "#FFFFFF");
      root.setProperty("--gold2", "#B89A52");
    } else {
      root.setProperty("--bg", "#0F0F0F");
      root.setProperty("--bg2", "#1A1A1A");
      root.setProperty("--card", "#1E1E1E");
      root.setProperty("--tx", "#E8E5E0");
      root.setProperty("--tx2", "#999");
      root.setProperty("--tx3", "#666");
      root.setProperty("--brd", "#2A2A2A");
      root.setProperty("--btn-text-on-accent", "#FFFFFF");
      root.setProperty("--gold2", "#B89A52");
    }
    localStorage.setItem("yugo-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
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
