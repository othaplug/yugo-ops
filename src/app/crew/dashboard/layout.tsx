import CrewAuthenticatedShell from "../components/CrewAuthenticatedShell";

export const metadata = { title: "Crew Dashboard" };

export default function CrewDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CrewAuthenticatedShell>{children}</CrewAuthenticatedShell>;
}
