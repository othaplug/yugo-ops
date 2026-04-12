export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BinOrderDetailClient from "./BinOrderDetailClient";

export default async function BinOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: order } = await db
    .from("bin_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) notFound();

  return <BinOrderDetailClient order={order} />;
}
