import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ClientDetailClient from "./ClientDetailClient";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: org } = await db.from("organizations").select("name").eq("id", id).single();
  const name = org?.name ? `Client ${org.name}` : "Client";
  return { title: name };
}

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
  const db = createAdminClient();

  const { data: client } = await db
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const { data: platformUser } = user
    ? await db.from("platform_users").select("role").eq("user_id", user.id).single()
    : { data: null };
  const isAdmin = isSuperAdmin || ["owner", "admin", "manager"].includes(platformUser?.role || "");

  const isB2C = client.type === "b2c";
  const vertical = String(client.vertical || client.type || "");
  const portfolioPartner = !isB2C && isPropertyManagementDeliveryVertical(vertical);

  const { data: deliveries } = portfolioPartner
    ? { data: [] as Record<string, unknown>[] }
    : await db
        .from("deliveries")
        .select("*")
        .eq("client_name", client.name)
        .order("scheduled_date", { ascending: false })
        .limit(10);

  const { data: partnerProperties } = portfolioPartner
    ? await db.from("partner_properties").select("*").eq("partner_id", id).order("building_name")
    : { data: [] as Record<string, unknown>[] };

  const { data: moves } = isB2C
    ? await db
        .from("moves")
        .select("id, move_number, move_code, client_name, status, stage, scheduled_date, created_at, estimate, pm_reason_code")
        .eq("organization_id", client.id)
        .order("scheduled_date", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: partnerMoves } = !isB2C
    ? await db
        .from("moves")
        .select(
          "id, move_number, move_code, client_name, status, stage, scheduled_date, created_at, estimate, pm_reason_code, partner_property_id"
        )
        .eq("organization_id", client.id)
        .order("scheduled_date", { ascending: false })
        .limit(100)
    : { data: [] };

  const moveIds = (moves || []).map((m: { id: string }) => m.id);
  const { data: changeRequests } = moveIds.length > 0
    ? await db
        .from("move_change_requests")
        .select("id, move_id, type, description, status, urgency, created_at, moves(move_code, client_name)")
        .in("move_id", moveIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: invoicesByName } = await db
    .from("invoices")
    .select("*")
    .eq("client_name", client.name)
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: invoicesByOrg } = !isB2C
    ? await db.from("invoices").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(80)
    : { data: [] as Record<string, unknown>[] };

  const invoiceMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(invoicesByOrg || []), ...(invoicesByName || [])]) {
    invoiceMap.set((row as { id: string }).id, row as Record<string, unknown>);
  }
  const allInvoices = [...invoiceMap.values()].sort(
    (a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime()
  );
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

  const { appId: squareAppId, locationId: squareLocationId } = await getSquarePaymentConfig().catch(() => ({ appId: "", locationId: "" }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

  let pmMetrics: {
    buildingsCount: number;
    totalMoves: number;
    movesThisMonth: number;
    revenueMtd: number;
    revenueYtd: number;
    avgMoveValue: number;
    onTimeRate: number | null;
  } | null = null;

  if (portfolioPartner) {
    const [{ count: totalMoves }, { count: movesThisMonth }, { data: estRows }] = await Promise.all([
      db.from("moves").select("id", { count: "exact", head: true }).eq("organization_id", id),
      db
        .from("moves")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", id)
        .gte("scheduled_date", monthStart),
      db
        .from("moves")
        .select("estimate")
        .eq("organization_id", id)
        .in("status", ["completed", "paid"])
        .not("estimate", "is", null)
        .limit(400),
    ]);

    const paid = allInvoices.filter((i) => (i.status as string) === "paid");
    const revenueMtd = paid
      .filter((i) => String(i.created_at || "").slice(0, 10) >= monthStart)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
    const revenueYtd = paid
      .filter((i) => String(i.created_at || "").slice(0, 10) >= yearStart)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
    const estimates = (estRows || []).map((r: { estimate?: number }) => Number(r.estimate || 0)).filter((n) => n > 0);
    const avgMoveValue = estimates.length ? estimates.reduce((a, b) => a + b, 0) / estimates.length : 0;

    pmMetrics = {
      buildingsCount: (partnerProperties || []).length,
      totalMoves: totalMoves ?? 0,
      movesThisMonth: movesThisMonth ?? 0,
      revenueMtd,
      revenueYtd,
      avgMoveValue,
      onTimeRate: null,
    };
  }

  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-4 py-6 animate-pulse text-[var(--tx3)] text-[12px]">Loading…</div>}>
      <ClientDetailClient
        client={client}
        deliveries={deliveries || []}
        moves={moves || []}
        partnerMoves={partnerMoves || []}
        partnerProperties={partnerProperties || []}
        portfolioPartner={portfolioPartner}
        pmMetrics={pmMetrics}
        changeRequests={changeRequests || []}
        allInvoices={allInvoices}
        outstandingTotal={outstandingTotal}
        partnerSince={partnerSince}
        partnerDuration={partnerDuration}
        backHref={backHref}
        isAdmin={!!isAdmin}
        isSuperAdmin={isSuperAdmin}
        squareAppId={squareAppId}
        squareLocationId={squareLocationId}
      />
    </Suspense>
  );
}