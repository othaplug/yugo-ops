export const metadata = { title: "Partners" };
export const dynamic = "force-dynamic";

import PartnersV3Client from "./PartnersV3Client";

export default function AllPartnersPage() {
  return <PartnersV3Client />;
}
