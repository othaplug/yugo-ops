import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientDetailClient from "./ClientDetailClient";
import { getSuperAdminEmail } from "@/lib/super-admin";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from === "retail" ? "/admin/partners/retail" : from === "designers" ? "/admin/partners/designers" : from === "hospitality" ? "/admin/partners/hospitality" : from === "gallery" ? "/admin/partners/gallery" : from === "realtors" ? "/admin/partners/realtors" : "/admin/clients";
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = (user?.email || "").toLowerCase() === getSuperAdminEmail();
  const { data: platformUser } = user
    ? await supabase.from("platform_users").select("role").eq("user_id", user.id).single()
    : { data: null };
  const isAdmin = isSuperAdmin || platformUser?.role === "admin" || platformUser?.role === "manager";

  const isB2C = client.type === "b2c";
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("client_name", client.name)
    .order("scheduled_date", { ascending: false })
    .limit(10);

  const { data: moves } = isB2C
    ? await supabase
        .from("moves")
        .select("id, move_number, client_name, status, stage, scheduled_date, created_at")
        .eq("organization_id", client.id)
        .order("scheduled_date", { ascending: false })
        .limit(10)
    : { data: [] };

  const moveIds = (moves || []).map((m: { id: string }) => m.id);
  const { data: changeRequests } = moveIds.length > 0
    ? await supabase
        .from("move_change_requests")
        .select("id, move_id, type, description, status, urgency, created_at, moves(move_code, client_name)")
        .in("move_id", moveIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_name", client.name)
    .order("created_at", { ascending: false })
    .limit(10);

  const allInvoices = invoices || [];
  const outstandingInvoices = allInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.amount), 0);

  const partnerSince = client.created_at ? new Date(client.created_at) : null;
  const partnerDuration = partnerSince
    ? (() => {
        const now = new Date();
        const months = (now.getFullYear() - partnerSince.getFullYear()) * 12 + (now.getMonth() - partnerSince.getMonth());
        if (months < 1) return "Less than 1 month";
        if (months < 12) return `${months} month${months > 1 ? "s" : ""}`;
        const years = Math.floor(months / 12);
        return `${years} year${years > 1 ? "s" : ""}`;
      })()
    : null;

  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-4 py-6 animate-pulse text-[var(--tx3)] text-[12px]">Loading…</div>}>
      <ClientDetailClient
        client={client}
        deliveries={deliveries || []}
        moves={moves || []}
        changeRequests={changeRequests || []}
        allInvoices={allInvoices}
        outstandingTotal={outstandingTotal}
        partnerSince={partnerSince}
        partnerDuration={partnerDuration}
        backHref={backHref}
        isAdmin={!!isAdmin}
      />
    </Suspense>
  );
}