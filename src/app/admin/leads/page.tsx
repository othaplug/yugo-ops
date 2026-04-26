import LeadsHubV3Client from "./LeadsHubV3Client";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Main Leads list (same as /admin/leads/all). Dashboard KPIs live at /admin/leads/dashboard.
 */
export default function LeadsPage() {
  return <LeadsHubV3Client mode="all" />;
}
