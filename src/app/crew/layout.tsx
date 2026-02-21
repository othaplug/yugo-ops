import { ReactNode } from "react";
import CrewThemeProvider from "./components/CrewThemeProvider";

export default function CrewLayout({ children }: { children: ReactNode }) {
  return <CrewThemeProvider>{children}</CrewThemeProvider>;
}
