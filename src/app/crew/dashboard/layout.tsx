import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import CrewShell from "../components/CrewShell";

export default async function CrewDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;

  if (!payload) {
    redirect("/crew/login");
  }

  return <CrewShell>{children}</CrewShell>;
}
