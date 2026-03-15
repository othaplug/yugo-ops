export const metadata = { title: "Claims" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ClaimsListClient from "./ClaimsListClient";

export default async function ClaimsPage() {
  const db = createAdminClient();

  const { data: claims } = await db
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const allClaims = claims || [];
  const openCount = allClaims.filter((c) => ["submitted", "under_review"].includes(c.status)).length;
  const reviewCount = allClaims.filter((c) => c.status === "under_review").length;
  const resolvedCount = allClaims.filter(
    (c) => ["approved", "partially_approved", "denied", "settled", "closed"].includes(c.status) && c.resolved_at && c.resolved_at >= thirtyDaysAgo
  ).length;
  const totalPaidOut = allClaims
    .filter((c) => c.approved_amount && c.resolved_at && c.resolved_at >= thirtyDaysAgo)
    .reduce((sum, c) => sum + (c.approved_amount || 0), 0);

  return (
    <ClaimsListClient
      claims={allClaims}
      stats={{ openCount, reviewCount, resolvedCount, totalPaidOut }}
    />
  );
}
