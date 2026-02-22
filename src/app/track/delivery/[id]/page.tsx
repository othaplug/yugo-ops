import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";
import TrackDeliveryClient from "./TrackDeliveryClient";

export default async function TrackDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const { token } = await searchParams;
  const supabase = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery, error } = byUuid
    ? await supabase.from("deliveries").select("*").eq("id", slug).single()
    : await supabase.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();
  if (!verifyTrackToken("delivery", delivery.id, token || "")) notFound();

  return (
    <TrackDeliveryClient
      delivery={delivery}
      token={token || ""}
    />
  );
}
