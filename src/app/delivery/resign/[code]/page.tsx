import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResignToken } from "@/lib/track-token";
import ResignForm from "./ResignForm";

/**
 * Client-facing resign page. Ships as the recovery lane for a delivery
 * whose crew-captured signature was lost mid-flight (DLV-30412 was
 * the incident that motivated it). The link the client receives is a
 * short URL like /delivery/resign/DLV-30412?token=<uuid>.<sig>. Server
 * verifies the HMAC signature here so tampered / brute-forced links
 * are rejected before we render the sign-off form.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DeliveryResignPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { code } = await params;
  const search = await searchParams;
  const tokenParam = Array.isArray(search.token) ? search.token[0] : search.token;
  if (!tokenParam) notFound();

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("deliveries")
    .select(
      "id, delivery_number, customer_name, recipient_name, delivery_address, business_name, scheduled_date, signoff_completed_at",
    )
    .ilike("delivery_number", code)
    .maybeSingle();
  if (!delivery) notFound();

  const verified = verifyResignToken(`${delivery.id}.${tokenParam}`);
  if (!verified || verified !== delivery.id) notFound();

  return (
    <ResignForm
      deliveryId={delivery.id}
      deliveryNumber={delivery.delivery_number}
      recipientName={
        (delivery as { recipient_name?: string | null }).recipient_name ||
        delivery.customer_name ||
        ""
      }
      deliveryAddress={delivery.delivery_address || ""}
      businessName={(delivery as { business_name?: string | null }).business_name || null}
      scheduledDate={delivery.scheduled_date || null}
      token={tokenParam}
      alreadySigned={false}
    />
  );
}
