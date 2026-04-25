export const metadata = { title: "Change Requests" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ChangeRequestsV3Client from "./ChangeRequestsV3Client";

export default async function ChangeRequestsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("move_change_requests")
    .select(`
      id,
      move_id,
      type,
      description,
      urgency,
      status,
      created_at,
      reviewed_at,
      moves (
        id,
        client_name,
        client_email,
        move_code,
        from_address,
        to_address,
        scheduled_date
      )
    `)
    .order("created_at", { ascending: false });

  const all = requests || [];
  const pending = all.filter((r: any) => r.status === "pending");
  const reviewed = all.filter((r: any) => r.status !== "pending");

  return (
    <ChangeRequestsV3Client
      all={all}
      pending={pending}
      reviewed={reviewed}
    />
  );
}
