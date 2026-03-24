import CrewAuthenticatedShell from "../components/CrewAuthenticatedShell";

export default function CrewExpenseLayout({ children }: { children: React.ReactNode }) {
  return <CrewAuthenticatedShell>{children}</CrewAuthenticatedShell>;
}
