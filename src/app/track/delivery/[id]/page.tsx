import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";

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

  const itemsCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    confirmed: "bg-emerald-500/20 text-emerald-400",
    scheduled: "bg-blue-500/20 text-blue-400",
    "in-transit": "bg-amber-400/20 text-amber-300",
    dispatched: "bg-amber-400/20 text-amber-300",
    delivered: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
  };
  const statusClass = statusColors[delivery.status] || "bg-amber-400/20 text-amber-300";

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E8E5E0] font-sans">
      <div className="max-w-[560px] mx-auto px-5 py-8 md:py-12">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.08)] border border-[rgba(201,169,98,0.35)] text-[#C9A962] font-semibold tracking-widest text-sm">
            OPS+
          </span>
        </div>
        <div className="text-[9px] font-bold tracking-widest uppercase text-[#C9A962] mb-2">Project Tracking</div>
        <h1 className="text-xl md:text-2xl font-bold mb-6">
          {delivery.delivery_number} — {delivery.customer_name}
        </h1>

        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-5 md:p-6 space-y-5">
          <div>
            <div className="text-[9px] font-bold uppercase text-[#666] mb-2">Status</div>
            <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${statusClass}`}>
              {delivery.status?.replace("-", " ")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#2A2A2A]">
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Delivery to</div>
              <div className="text-sm">{delivery.delivery_address || "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Pickup from</div>
              <div className="text-sm">{(delivery as any).pickup_address || "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Date & window</div>
              <div className="text-sm font-semibold">
                {delivery.scheduled_date || "—"} • {delivery.delivery_window || "—"}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Items</div>
              <div className="text-sm font-semibold">{itemsCount} items</div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#666] mt-8">
          <Link href="/" className="text-[#C9A962] hover:underline">OPS+</Link> · Powered by OPS+
        </p>
      </div>
    </div>
  );
}
