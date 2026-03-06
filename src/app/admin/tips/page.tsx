export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import TipsClient from "./TipsClient";

export default async function TipsPage() {
  const db = createAdminClient();
  const { data: tips } = await db
    .from("tips")
    .select("id, move_id, crew_id, crew_name, client_name, amount, processing_fee, net_amount, charged_at")
    .order("charged_at", { ascending: false })
    .limit(100);

  const totalTips = (tips || []).reduce((s, t) => s + Number(t.amount || 0), 0);
  const tipCount = (tips || []).length;
  const avgTip = tipCount > 0 ? totalTips / tipCount : 0;

  return <TipsClient tips={tips || []} totalTips={totalTips} avgTip={avgTip} tipCount={tipCount} />;
}
