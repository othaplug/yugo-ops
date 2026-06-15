"use client";

import { toTitleCase } from "@/lib/format-text";
import { useEffect, useState } from "react";
import { ClipboardText, Clock } from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";

type LogRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
};

/* Premium client palette (explicit, never admin dark vars). */
const BG = "#FAF7F2";
const INK = "#241C16";
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const MUTED = "rgba(36,28,22,0.58)";
const CARD_BORDER = "rgba(92,26,51,0.14)";

export default function PublicInboundTrackClient({
  id,
  token,
}: {
  id: string;
  token: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{
    shipment: Record<string, unknown> & {
      status_label?: string;
      shipment_number?: string;
    };
    log: LogRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/inbound-shipment/${id}?token=${encodeURIComponent(token)}`,
        );
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
      <div
        className="min-h-screen flex items-center justify-center text-[14px]"
        style={{ backgroundColor: BG, color: MUTED }}
      >
        Loading…
      </div>
    );
  }
  if (err || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: BG }}
      >
        <p className="text-[14px] text-center" style={{ color: "#B42318" }}>
          {err || "Not found"}
        </p>
      </div>
    );
  }

  const s = data.shipment;
  const num = (s.shipment_number as string) || "";
  const photos = Array.isArray(s.inspection_photos)
    ? (s.inspection_photos as string[])
    : [];

  const card =
    "rounded-2xl border bg-white p-6 shadow-[0_2px_14px_rgba(92,26,51,0.05)]";

  return (
    <div className="min-h-screen px-4 py-12" style={{ backgroundColor: BG, color: INK }}>
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <YugoLogo size={28} variant="black" />
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em] mt-3"
            style={{ color: MUTED }}
          >
            Inbound shipment
          </p>
          <h1 className="font-hero text-[28px] mt-1" style={{ color: INK }}>
            {num || "Your shipment"}
          </h1>
        </div>

        <div className={`${card} mb-5`} style={{ borderColor: CARD_BORDER }}>
          <div
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] mb-2"
            style={{ color: MUTED }}
          >
            <Clock size={16} style={{ color: WINE }} aria-hidden />
            Status
          </div>
          <p className="font-hero text-[22px]" style={{ color: WINE }}>
            {(s.status_label as string) || String(s.status)}
          </p>
          {s.carrier_tracking_number ? (
            <p className="text-[13px] mt-2" style={{ color: MUTED }}>
              Tracking: {String(s.carrier_tracking_number)}
            </p>
          ) : null}
        </div>

        {photos.length > 0 && (
          <div className={`${card} mb-5`} style={{ borderColor: CARD_BORDER }}>
            <div
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] mb-3"
              style={{ color: MUTED }}
            >
              <ClipboardText size={16} style={{ color: WINE }} aria-hidden />
              Inspection photos
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {photos.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square rounded-xl overflow-hidden border"
                  style={{ borderColor: CARD_BORDER, backgroundColor: "#f3efe9" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Inspection" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className={card} style={{ borderColor: CARD_BORDER }}>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.1em] mb-4"
            style={{ color: MUTED }}
          >
            Timeline
          </div>
          <ul className="space-y-0">
            {data.log.map((row, i) => (
              <li key={row.id} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: i === 0 ? WINE : `${FOREST}40` }}
                    aria-hidden
                  />
                  {i < data.log.length - 1 && (
                    <span
                      className="w-px flex-1 my-1"
                      style={{ backgroundColor: `${FOREST}1F` }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="pb-5 min-w-0">
                  <div className="text-[14px] font-semibold" style={{ color: INK }}>
                    {toTitleCase(row.status)}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                  {row.notes ? (
                    <div className="text-[13px] mt-1 leading-snug" style={{ color: FOREST }}>
                      {row.notes}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
