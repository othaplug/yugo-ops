import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { isUuid, getDeliveryDetailPath } from "@/lib/move-code";
import { ManifestPrintBar } from "./ManifestPrintBar";

const READINESS_LABEL: Record<string, string> = {
  confirmed: "Ready",
  pending: "Pending",
  partial: "Partial",
  delayed: "Delayed",
};

const ACCESS_LABEL: Record<string, string> = {
  elevator: "Elevator",
  ground_floor: "Ground floor",
  loading_dock: "Loading dock",
  walk_up_2: "Walk-up (2 flights)",
  walk_up_3: "Walk-up (3 flights)",
  walk_up_4_plus: "Walk-up (4+ flights)",
  long_carry: "Long carry",
  narrow_stairs: "Narrow stairs",
  no_parking: "No parking",
};

function formatAccess(raw: string | null | undefined): string {
  if (!raw) return "";
  return ACCESS_LABEL[raw] || raw.replace(/_/g, " ");
}

export default async function DeliveryManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const db = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery, error } = byUuid
    ? await db.from("deliveries").select("*").eq("id", slug).single()
    : await db.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();

  const { data: stops } = await db
    .from("delivery_stops")
    .select(
      "id, stop_number, address, vendor_name, contact_name, contact_phone, contact_email, access_type, access_notes, readiness, readiness_notes, items_description, special_instructions, notes, stop_type, is_final_destination, customer_name, customer_phone",
    )
    .eq("delivery_id", delivery.id)
    .order("stop_number");

  const stopList = stops || [];
  let itemsByStop: Record<
    string,
    Array<{
      description: string;
      quantity: number;
      weight_range: string | null;
      is_fragile: boolean | null;
      is_high_value: boolean | null;
      requires_assembly: boolean | null;
    }>
  > = {};

  if (stopList.length > 0) {
    const { data: stopItems } = await db
      .from("delivery_stop_items")
      .select(
        "stop_id, description, quantity, weight_range, is_fragile, is_high_value, requires_assembly",
      )
      .in(
        "stop_id",
        stopList.map((s) => s.id),
      );
    for (const row of stopItems || []) {
      const sid = row.stop_id as string;
      if (!itemsByStop[sid]) itemsByStop[sid] = [];
      itemsByStop[sid].push({
        description: String(row.description),
        quantity: Number(row.quantity) || 1,
        weight_range: (row.weight_range as string | null) ?? null,
        is_fragile: row.is_fragile as boolean | null,
        is_high_value: row.is_high_value as boolean | null,
        requires_assembly: row.requires_assembly as boolean | null,
      });
    }
  }

  const title =
    String(delivery.project_name || "").trim() ||
    String(delivery.customer_name || delivery.delivery_number || "Delivery");
  const partner = String(delivery.client_name || "").trim();
  const endName = String(delivery.end_client_name || "").trim();
  const endPhone = String(delivery.end_client_phone || "").trim();
  const scheduled =
    delivery.scheduled_date && delivery.time_slot
      ? `${delivery.scheduled_date} · ${delivery.time_slot}`
      : String(delivery.scheduled_date || "");

  return (
    <div className="min-h-screen bg-white text-zinc-900 print:bg-white print:text-black">
      <div className="max-w-3xl mx-auto px-6 py-8 print:py-4 print:px-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4 mb-6 print:mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-zinc-600 mt-1 font-mono">
              {delivery.delivery_number}
              {delivery.is_multi_stop ? (
                <span className="ml-2 font-sans text-zinc-500">
                  · {stopList.length} stops
                </span>
              ) : null}
            </p>
            {partner ? <p className="text-sm mt-2">Partner: {partner}</p> : null}
            {(endName || endPhone) && (
              <p className="text-sm mt-1">
                End client: {endName}
                {endPhone ? ` · ${endPhone}` : ""}
              </p>
            )}
            {scheduled ? <p className="text-sm mt-2 text-zinc-700">Scheduled: {scheduled}</p> : null}
          </div>
          <ManifestPrintBar backHref={getDeliveryDetailPath(delivery)} />
        </div>

        <ol className="space-y-6 list-decimal list-inside marker:font-bold marker:text-zinc-800">
          {stopList.map((stop) => {
            const isFinal = !!stop.is_final_destination;
            const items = itemsByStop[stop.id] || [];
            const readiness = READINESS_LABEL[String(stop.readiness || "confirmed")] || stop.readiness;
            return (
              <li key={stop.id} className="pl-0">
                <div className="inline-block align-top w-[calc(100%-1.5rem)]">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="font-bold">
                      {isFinal ? "Delivery" : "Pickup"} ·{" "}
                      {stop.vendor_name || stop.customer_name || `Stop ${stop.stop_number}`}
                    </span>
                    {!isFinal && readiness ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        {readiness}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-800">{stop.address || "—"}</p>
                  {(stop.contact_name || stop.contact_phone) && (
                    <p className="text-sm mt-1">
                      Contact: {[stop.contact_name, stop.contact_phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {stop.access_type || stop.access_notes ? (
                    <p className="text-sm mt-1 text-zinc-700">
                      Access: {formatAccess(stop.access_type)}
                      {stop.access_notes ? ` · ${stop.access_notes}` : ""}
                    </p>
                  ) : null}
                  {(stop.readiness === "partial" || stop.readiness === "delayed") &&
                  stop.readiness_notes ? (
                    <p className="text-sm mt-1 text-amber-900">Note: {stop.readiness_notes}</p>
                  ) : null}
                  {items.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm list-disc pl-5">
                      {items.map((it, idx) => (
                        <li key={idx}>
                          {it.quantity}× {it.description}
                          {it.is_fragile ? " (fragile)" : ""}
                          {it.requires_assembly ? " (assembly)" : ""}
                          {it.weight_range && it.weight_range !== "standard"
                            ? ` · ${it.weight_range.replace(/_/g, " ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : stop.items_description ? (
                    <p className="text-sm mt-2 whitespace-pre-wrap">{stop.items_description}</p>
                  ) : null}
                  {(stop.notes || stop.special_instructions) && (
                    <p className="text-sm mt-2 italic text-zinc-600">
                      {stop.notes || stop.special_instructions}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {delivery.special_instructions ? (
          <div className="mt-8 pt-4 border-t border-zinc-200">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1">
              Job instructions
            </p>
            <p className="text-sm whitespace-pre-wrap">{delivery.special_instructions}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
