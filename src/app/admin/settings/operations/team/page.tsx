import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Team" };

export default function OperationsTeamRedirect() {
  redirect("/admin/platform?tab=crews");
}
