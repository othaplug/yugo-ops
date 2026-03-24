import CrewAuthenticatedShell from "../components/CrewAuthenticatedShell";

export const metadata = { title: "Crew Stats" };

export default function CrewStatsLayout({ children }: { children: React.ReactNode }) {
  return <CrewAuthenticatedShell>{children}</CrewAuthenticatedShell>;
}
