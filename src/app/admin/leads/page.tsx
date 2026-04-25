export const metadata = { title: "Leads — Dashboard" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubV3Client from "./LeadsHubV3Client";

export default function LeadsDashboardPage() {
  return <LeadsHubV3Client mode="dashboard" />;
}
