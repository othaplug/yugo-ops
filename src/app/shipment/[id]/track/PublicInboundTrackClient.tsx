"use client";

import { toTitleCase } from "@/lib/format-text";
import { useEffect, useState } from "react";
import { ShippingContainer, ClipboardText, Clock } from "@phosphor-icons/react";

type LogRow = { id: string; status: string; notes: string | null; created_at: string };

export default function PublicInboundTrackClient({ id, token }: { id: string; token: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{
    shipment: Record<string, unknown> & { status_label?: string; shipment_number?: string };
    log: LogRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/inbound-shipment/${id}?token=${encodeURIComponent(token)}`);
        const j = await res.json();
        if (!res.ok) {
          if (!cancelled) setErr(j.error || "Unable to load");
          return;
        }
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setErr("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-[var(--tx3)] text-sm">
        Loading…
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
        <p className="text-red-600 text-sm text-center">{err || "Not found"}</p>
      </div>
    );
  }

  const s = data.shipment;
  const num = (s.shipment_number as string) || "";
  const photos = Array.isArray(s.inspection_photos) ? (s.inspection_photos as string[]) : [];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[var(--tx)] px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ShippingContainer className="text-[#C9A962]" size={28} weight="regular" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">Inbound shipment</h1>
        </div>
        <p className="text-sm text-[var(--tx3)] mb-6">Reference {num}</p>

        <div className="rounded-2xl border border-[var(--brd)] bg-white p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-1">
            <Clock size={18} className="text-[#C9A962]" aria-hidden />
            Status
          </div>
          <p className="text-lg font-semibold">{(s.status_label as string) || String(s.status)}</p>
          {s.carrier_tracking_number ? (
            <p className="text-sm text-[var(--tx3)] mt-2">
              Tracking: {String(s.carrier_tracking_number)}
            </p>
          ) : null}
        </div>

        {photos.length > 0 && (
          <div className="rounded-2xl border border-[var(--brd)] bg-white p-5 shadow-sm mb-6">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <ClipboardText size={18} className="text-[#C9A962]" aria-hidden />
              Inspection photos
            </div>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-[#f0f0f0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--brd)] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold mb-4">Timeline</div>
          <ul className="space-y-4">
            {data.log.map((row) => (
              <li key={row.id} className="flex gap-3 text-sm">
                <div>
                  <div className="font-medium">{toTitleCase(row.status)}</div>
                  <div className="text-[var(--tx3)] text-xs">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                  {row.notes ? <div className="text-[var(--tx3)] mt-1">{row.notes}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
