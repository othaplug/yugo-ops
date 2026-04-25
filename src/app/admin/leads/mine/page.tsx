export const metadata = { title: "My Leads" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsHubV3Client from "../LeadsHubV3Client";

export default function MyLeadsPage() {
  return <LeadsHubV3Client mode="mine" />;
}
