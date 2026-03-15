import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { isUuid, getDeliveryDetailPath } from "@/lib/move-code";
import DeliveryDetailClient from "./DeliveryDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const db = createAdminClient();
  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await db.from("deliveries").select("delivery_number").eq("id", slug).single()
    : await db.from("deliveries").select("delivery_number").ilike("delivery_number", slug).single();
  const name = delivery?.delivery_number ? `Delivery ${delivery.delivery_number}` : "Delivery";
  return { title: name };
}

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

  const isDayRate = delivery.booking_type === "day_rate";
  const [{ data: org }, { data: orgs }, { data: crews }, { data: etaSmsLog }, stopsResult] = await Promise.all([
    db.from("organizations").select("email").eq("name", delivery.client_name).limit(1).maybeSingle(),
    db.from("organizations").select("id, name, type").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
    db.from("eta_sms_log").select("message_type, sent_at, eta_minutes, twilio_sid").eq("delivery_id", delivery.id).order("sent_at", { ascending: false }),
    isDayRate ? db.from("delivery_stops").select("id, stop_number, address, customer_name, customer_phone, items_description, special_instructions").eq("delivery_id", delivery.id).order("stop_number") : Promise.resolve({ data: null }),
  ]);

  const stops = (stopsResult as { data: Array<{ id: string; stop_number: number; address: string; customer_name: string | null; customer_phone: string | null; items_description: string | null; special_instructions: string | null }> | null })?.data ?? null;

  return <DeliveryDetailClient delivery={delivery} clientEmail={org?.email} organizations={orgs || []} crews={crews || []} stops={stops} etaSmsLog={etaSmsLog ?? []} />;
}
