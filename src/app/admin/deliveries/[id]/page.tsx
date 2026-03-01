import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isUuid, getDeliveryDetailPath } from "@/lib/move-code";
import DeliveryDetailClient from "./DeliveryDetailClient";

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const supabase = await createClient();
  const byUuid = isUuid(slug);

  const { data: delivery, error } = byUuid
    ? await supabase.from("deliveries").select("*").eq("id", slug).single()
    : await supabase.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();

  if (byUuid && delivery.delivery_number?.trim()) {
    redirect(getDeliveryDetailPath(delivery));
  }

  const [{ data: org }, { data: orgs }, { data: crews }] = await Promise.all([
    supabase.from("organizations").select("email").eq("name", delivery.client_name).limit(1).maybeSingle(),
    supabase.from("organizations").select("id, name, type").order("name"),
    supabase.from("crews").select("id, name, members").order("name"),
  ]);

  return <DeliveryDetailClient delivery={delivery} clientEmail={org?.email} organizations={orgs || []} crews={crews || []} />;
}
