import CrewAuthenticatedShell from "../components/CrewAuthenticatedShell";

export const metadata = { title: "Bin Tasks" };

export default function CrewBinOrdersLayout({ children }: { children: React.ReactNode }) {
  return <CrewAuthenticatedShell>{children}</CrewAuthenticatedShell>;
}
