import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";
import TrackTipClient from "./TrackTipClient";

export const metadata: Metadata = {
  title: "Tip Your Crew",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

export default async function TrackTipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; amount?: string }>;
}) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const { token, amount } = await searchParams;

  if (!token?.trim()) notFound();

  const supabase = createAdminClient();
  const byUuid = isUuid(slug);
  const { data: delivery, error } = byUuid
    ? await supabase.from("deliveries").select("id, customer_name, client_name").eq("id", slug).single()
    : await supabase
        .from("deliveries")
        .select("id, customer_name, client_name")
        .ilike("delivery_number", slug)
        .single();

  if (error || !delivery) notFound();
  if (!verifyTrackToken("delivery", delivery.id, token)) notFound();

  const deliverySlug = byUuid ? delivery.id : slug;
  const initialAmount = amount ? parseFloat(amount) : undefined;
  const backUrl = `/track/delivery/${encodeURIComponent(deliverySlug)}?token=${encodeURIComponent(token)}`;

  return (
    <TrackTipClient
      deliveryId={delivery.id}
      token={token}
      initialAmount={
        initialAmount != null && Number.isFinite(initialAmount)
          ? initialAmount
          : undefined
      }
      backUrl={backUrl}
      deliverySlug={String(deliverySlug)}
    />
  );
}
