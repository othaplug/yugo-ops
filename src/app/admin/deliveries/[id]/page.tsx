import NotifyClient from "./NotifyClient";
import DownloadPDF from "./DownloadPDF";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Topbar from "../../components/Topbar";
import Badge from "../../components/Badge";
import Link from "next/link";
import StatusUpdater from "./StatusUpdater";
import EditDeliveryModal from "./EditDeliveryModal";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", id)
    .single();

  if (!delivery) notFound();

  return (
    <>
      <Topbar title="Delivery Detail" subtitle={delivery.delivery_number} />
      <div className="max-w-[1200px] px-6 py-5">
        <Link
          href="/admin/deliveries"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3"
        >
          ← Back
        </Link>

        {/* Header */}
        <div className="flex justify-between items-start flex-wrap gap-2 mb-4">
          <div>
            <div className="font-serif text-xl">{delivery.customer_name}</div>
            <div className="text-[10px] text-[var(--tx3)]">
              {delivery.delivery_number} • {delivery.client_name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={delivery.status} />
            <StatusUpdater deliveryId={delivery.id} currentStatus={delivery.status} />
          </div>
        </div>

        {/* Detail Grid Row 1 */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">From</div>
            <div className="text-xs font-medium">{delivery.pickup_address}</div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">To</div>
            <div className="text-xs font-medium">{delivery.delivery_address}</div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Window</div>
            <div className="text-xs font-medium">{delivery.scheduled_date} • {delivery.delivery_window}</div>
          </div>
        </div>

        {/* Detail Grid Row 2 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Category</div>
            <div className="text-xs font-medium capitalize">{delivery.category}</div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Items</div>
            <div className="text-xs font-medium">{delivery.items?.join(", ") || "None"}</div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Instructions</div>
            <div className="text-xs font-medium">{delivery.instructions || "None"}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5">
          <EditDeliveryModal delivery={delivery} />
          <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all">
            Generate Invoice
          </button>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all">
            <NotifyClient delivery={delivery} />
          </button>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all">
           <DownloadPDF delivery={delivery} />
          </button>
        </div>
      </div>
    </>
  );
}