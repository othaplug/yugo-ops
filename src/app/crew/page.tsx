import { redirect } from "next/navigation";

/** /crew redirects to the Crew Portal login (tablet app). */
export default function CrewPage() {
  redirect("/crew/login");
}