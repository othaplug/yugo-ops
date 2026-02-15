import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditDeliveryModal from "./EditDeliveryModal";
import GenerateInvoiceButton from "./GenerateInvoiceButton";
import NotifyClientButton from "./NotifyClientButton";
import DownloadPDFButton from "./DownloadPDFButton";

export default async function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !delivery) notFound();

  const statusColorMap: Record<string, string> = {
    pending: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
    confirmed: "text-[var(--blu)] bg-[rgba(59,130,246,0.1)]",
    "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
    delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
    cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
  };
  const statusColor = statusColorMap[delivery.status] || "text-[var(--tx3)] bg-[var(--card)]";

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5">
        {/* Header Card */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-[20px] font-bold text-[var(--tx)]">{delivery.delivery_number}</h1>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
                  {delivery.status}
                </span>
              </div>
              <div className="text-[12px] text-[var(--tx3)]">
                Created {new Date(delivery.created_at).toLocaleDateString()} • Customer: {delivery.customer_name}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 [&_button]:min-h-[44px] [&_button]:touch-manipulation">
              <EditDeliveryModal delivery={delivery} />
              <GenerateInvoiceButton delivery={delivery} />
              <NotifyClientButton delivery={delivery} />
              <DownloadPDFButton delivery={delivery} />
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Customer Info */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Customer Information</h3>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Name</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.customer_name}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Email</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.customer_email || "Not provided"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Phone</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.customer_phone || "Not provided"}</div>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Delivery Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Scheduled Date</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.scheduled_date || "Not scheduled"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Pickup Address</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.pickup_address || "Not specified"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Delivery Address</div>
                <div className="text-[13px] text-[var(--tx)]">{delivery.delivery_address || "Not specified"}</div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Items</h3>
            {delivery.items && delivery.items.length > 0 ? (
              <ul className="space-y-2">
                {delivery.items.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-[13px] text-[var(--tx)]">
                    <span className="text-[var(--gold)]">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12px] text-[var(--tx3)]">No items listed</div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Pricing</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--tx3)]">Quoted Price</span>
                <span className="text-[15px] font-bold text-[var(--gold)]">
                  ${delivery.quoted_price?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {delivery.instructions && (
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-3">Special Instructions</h3>
            <p className="text-[13px] text-[var(--tx)] leading-relaxed">{delivery.instructions}</p>
          </div>
        )}
    </div>
  );
}