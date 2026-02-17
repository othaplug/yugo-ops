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

  // Redirect UUID URLs to canonical short URL: /admin/deliveries/DEL-1234
  if (byUuid && delivery.delivery_number?.trim()) {
    redirect(getDeliveryDetailPath(delivery));
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("email")
    .eq("name", delivery.client_name)
    .limit(1)
    .maybeSingle();

  return <DeliveryDetailClient delivery={delivery} clientEmail={org?.email} />;
}
