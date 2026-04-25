export const metadata = { title: "All Leads" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubV3Client from "../LeadsHubV3Client";

export default function AllLeadsPage() {
  return <LeadsHubV3Client mode="all" />;
}
