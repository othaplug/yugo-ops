import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import CrewThemeProvider from "./components/CrewThemeProvider";
import CrewAlwaysOnLocation from "./components/CrewAlwaysOnLocation";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Yugo Crew" },
};

export const viewport: Viewport = {
  themeColor: "#B8962E",
};

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <CrewThemeProvider>
      <CrewAlwaysOnLocation />
      {children}
    </CrewThemeProvider>
  );
}
