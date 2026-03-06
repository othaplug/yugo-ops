import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { isUuid, getDeliveryDetailPath } from "@/lib/move-code";
import DeliveryDetailClient from "./DeliveryDetailClient";

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const db = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery, error } = byUuid
    ? await db.from("deliveries").select("*").eq("id", slug).single()
    : await db.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();

  if (byUuid && delivery.delivery_number?.trim()) {
    redirect(getDeliveryDetailPath(delivery));
  }

  const [{ data: org }, { data: orgs }, { data: crews }] = await Promise.all([
    db.from("organizations").select("email").eq("name", delivery.client_name).limit(1).maybeSingle(),
    db.from("organizations").select("id, name, type").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  return <DeliveryDetailClient delivery={delivery} clientEmail={org?.email} organizations={orgs || []} crews={crews || []} />;
}
