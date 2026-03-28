export const metadata = { title: "Leads — Dashboard" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubClient from "./LeadsHubClient";

export default function LeadsDashboardPage() {
  return <LeadsHubClient mode="dashboard" />;
}
