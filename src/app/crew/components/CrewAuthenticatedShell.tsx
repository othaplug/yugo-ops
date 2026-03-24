import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import CrewShell from "./CrewShell";

/** Auth + sidebar for crew portal pages (dashboard, stats, expenses, etc.). */
export default async function CrewAuthenticatedShell({
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
