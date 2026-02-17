import { createClient } from "@/lib/supabase/server";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: deliveries },
    { data: moves },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*"),
    supabase.from("invoices").select("*"),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const allInvoices = invoices || [];

  const todayDeliveries = allDeliveries.filter((d) => d.scheduled_date === today);
  const overdueAmount = allInvoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const b2cUpcoming = allMoves.filter((m) => m.status === "confirmed" || m.status === "scheduled");

  const categoryIcons: Record<string, string> = {
    retail: "sofa",
    designer: "palette",
    hospitality: "hotel",
    gallery: "image",
  };
  const categoryBgs: Record<string, string> = {
    retail: "var(--gdim)",
    designer: "var(--prdim)",
    hospitality: "var(--ordim)",
    gallery: "var(--bldim)",
  };

  return (
    <AdminPageClient
      todayDeliveries={todayDeliveries}
      allDeliveries={allDeliveries}
      b2cUpcoming={b2cUpcoming}
      overdueAmount={overdueAmount}
      categoryBgs={categoryBgs}
      categoryIcons={categoryIcons}
    />
  );
}
