export const dynamic = "force-dynamic";
export const metadata = { title: "Bin Rentals" };

import { createAdminClient } from "@/lib/supabase/admin";
import BinRentalsClient from "./BinRentalsClient";

export default async function BinRentalsPage() {
  const db = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { data: orders },
    { count: activeCount },
    { count: dropoffsThisWeek },
    { count: pickupsThisWeek },
    { data: revenueRows },
  ] = await Promise.all([
    db.from("bin_orders").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("bin_orders").select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "drop_off_scheduled", "bins_delivered", "in_use", "pickup_scheduled"]),
    db.from("bin_orders").select("id", { count: "exact", head: true })
      .gte("drop_off_date", today).lte("drop_off_date", weekEndStr)
      .neq("status", "cancelled"),
    db.from("bin_orders").select("id", { count: "exact", head: true })
      .gte("pickup_date", today).lte("pickup_date", weekEndStr)
      .neq("status", "cancelled"),
    db.from("bin_orders").select("total")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .eq("payment_status", "paid"),
  ]);

  const revenue30d = (revenueRows || []).reduce((sum, r) => sum + Number(r.total || 0), 0);

  return (
    <BinRentalsClient
      orders={orders || []}
      stats={{
        activeOrders: activeCount ?? 0,
        dropoffsThisWeek: dropoffsThisWeek ?? 0,
        pickupsThisWeek: pickupsThisWeek ?? 0,
        revenue30d,
      }}
    />
  );
}
