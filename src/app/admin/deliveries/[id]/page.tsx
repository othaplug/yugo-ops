import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DeliveryDetailClient from "./DeliveryDetailClient";

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !delivery) notFound();

  return <DeliveryDetailClient delivery={delivery} />;
}