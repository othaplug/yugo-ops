export const metadata = { title: "My Leads" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubClient from "../LeadsHubClient";

export default function MyLeadsPage() {
  return <LeadsHubClient mode="mine" />;
}
