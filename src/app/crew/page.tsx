import { redirect } from "next/navigation";

export const metadata = { title: "Crew" };

/** /crew redirects to the Crew Portal login (tablet app). */
export default function CrewPage() {
  redirect("/crew/login");
}