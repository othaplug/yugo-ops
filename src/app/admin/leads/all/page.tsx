export const metadata = { title: "All Leads" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubClient from "../LeadsHubClient";

export default function AllLeadsPage() {
  return <LeadsHubClient mode="all" />;
}
