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

  // If linked to a move, fetch move code
  let moveCode: string | null = null;
  if (order.move_id) {
    const { data: move } = await db
      .from("moves")
      .select("move_code")
      .eq("id", order.move_id)
      .single();
    moveCode = move?.move_code ?? null;
  }

  return <BinOrderDetailClient order={order} moveCode={moveCode} />;
}
