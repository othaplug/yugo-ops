import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";
import TrackTipClient from "./TrackTipClient";
import { GOLD } from "@/lib/client-theme";

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
    ? await supabase.from("deliveries").select("id").eq("id", slug).single()
    : await supabase
        .from("deliveries")
        .select("id")
        .ilike("delivery_number", slug)
        .single();

  if (error || !delivery) notFound();
  if (!verifyTrackToken("delivery", delivery.id, token)) notFound();

  const deliverySlug = byUuid ? delivery.id : slug;

  const { data: pod } = await supabase
    .from("proof_of_delivery")
    .select("move_id")
    .eq("delivery_id", delivery.id)
    .not("move_id", "is", null)
    .limit(1)
    .maybeSingle();

  const initialAmount = amount ? parseFloat(amount) : undefined;
  const backUrl = `/track/delivery/${encodeURIComponent(deliverySlug)}?token=${encodeURIComponent(token)}`;

  if (!pod?.move_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4">
        <div className="text-center max-w-md">
          <h1
            className="font-heading text-2xl font-bold text-[#E8E5E0] mb-2"
          >
            Tipping not available
          </h1>
          <p className="text-[#B0ADA8] text-[13px] mb-6">
            Tipping isn&apos;t set up for this delivery. Thank you for your feedback on the delivery—we appreciate it!
          </p>
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              backgroundColor: GOLD,
              color: "#0D0D0D",
            }}
          >
            ← Back to delivery
          </Link>
        </div>
      </div>
    );
  }

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
