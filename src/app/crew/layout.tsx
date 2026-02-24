import { ReactNode } from "react";
import CrewThemeProvider from "./components/CrewThemeProvider";
import CrewAlwaysOnLocation from "./components/CrewAlwaysOnLocation";

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <CrewThemeProvider>
      <CrewAlwaysOnLocation />
      {children}
    </CrewThemeProvider>
  );
}
