"use client";

import { waiverCategoryByCode, type WaiverCategoryCode } from "@/lib/waivers/waiver-categories";
import { formatPlatformDisplay } from "@/lib/date-format";

export type MoveWaiverRow = {
  id: string;
  category: string;
  item_name: string;
  description: string;
  crew_recommendation: string | null;
  reported_by_name: string | null;
  status: string;
  signed_by: string | null;
  signed_at: string | null;
  photoUrlsSigned: string[];
  signature_data: string | null;
};

function categoryLabel(code: string): string {
  const c = waiverCategoryByCode[code as WaiverCategoryCode];
  return c?.label ?? code.replace(/_/g, " ");
}

function recommendationLabel(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === "proceed_with_caution") return "Proceed with caution";
  if (raw === "do_not_recommend") return "Do not recommend";
  return raw.replace(/_/g, " ");
}

export default function MoveWaiversSection({ waivers }: { waivers: MoveWaiverRow[] }) {
  if (!waivers.length) return null;

  return (
    <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-3">
        On-site waivers
      </h3>
      <div className="space-y-3">
        {waivers.map((w) => (
          <div
            key={w.id}
            className={`p-4 rounded-lg border ${
              w.status === "signed"
                ? "bg-amber-50/90 border-amber-200/80"
                : "bg-[var(--bg)] border-[var(--brd)]"
            }`}
          >
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--tx)]">{w.item_name}</p>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                  {categoryLabel(w.category)}
                  {w.reported_by_name ? (
                    <>
                      {" "}
                      · {w.reported_by_name}
                    </>
                  ) : null}
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                  w.status === "signed"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-[var(--gdim)] text-[var(--tx3)]"
                }`}
              >
                {w.status === "signed" ? "Signed" : "Declined, item skipped"}
              </span>
            </div>
            {recommendationLabel(w.crew_recommendation) && (
              <p className="text-[10px] text-[var(--tx3)] mt-2">
                Crew: {recommendationLabel(w.crew_recommendation)}
              </p>
            )}
            <p className="text-[11px] text-[var(--tx2)] mt-2 leading-relaxed whitespace-pre-wrap">
              {w.description}
            </p>
            {w.photoUrlsSigned.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {w.photoUrlsSigned.map((url, i) =>
                  url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${w.id}-p-${i}`}
                      src={url}
                      alt=""
                      className="w-14 h-14 rounded object-cover border border-[var(--brd)]"
                    />
                  ) : null,
                )}
              </div>
            )}
            {w.status === "signed" && w.signature_data && (
              <div className="mt-3 border-t border-amber-200/80 pt-2">
                <p className="text-[10px] text-amber-900/90">
                  Signed by {w.signed_by ?? "Client"}
                  {w.signed_at
                    ? ` on ${formatPlatformDisplay(w.signed_at, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : null}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.signature_data}
                  alt=""
                  className="h-10 mt-1 max-w-full object-contain object-left opacity-90"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
