import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import CrewCssVarsBridge from "./components/CrewCssVarsBridge";
import CrewThemeProvider from "./components/CrewThemeProvider";
import CrewAlwaysOnLocation from "./components/CrewAlwaysOnLocation";
import CrewLocalPreferencesHydration from "./components/CrewLocalPreferencesHydration";
import CrewRouteLightLock from "./components/CrewRouteLightLock";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yugo Crew",
  },
};

export const viewport: Viewport = {
  themeColor: "#5C1A33",
};

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <CrewThemeProvider>
      <CrewCssVarsBridge />
      <div className="crew-app min-h-dvh w-full max-w-full min-w-0 overflow-x-clip">
        <CrewRouteLightLock />
        <CrewLocalPreferencesHydration />
        <CrewAlwaysOnLocation />
        {children}
      </div>
    </CrewThemeProvider>
  );
}
