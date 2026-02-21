"use client";

import { ThemeProvider } from "@/app/admin/components/ThemeContext";

export default function CrewThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
