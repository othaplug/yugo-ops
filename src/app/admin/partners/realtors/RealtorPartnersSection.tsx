"use client";

import Link from "next/link";
import { UserPlus } from "@phosphor-icons/react";

type RealtorPartner = { id: string; name: string | null; contact_name?: string | null; email?: string | null };

export default function RealtorPartnersSection({ partners }: { partners: RealtorPartner[] }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
          Realtor Partners (portal access)
        </h3>
        <Link
          href="/admin/clients/new?type=partner&partnerType=realtor"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all whitespace-nowrap"
        >
          <UserPlus size={14} weight="regular" className="text-current shrink-0" aria-hidden />
          Add Realtor Partner
        </Link>
      </div>
      <p className="text-[11px] text-[var(--tx3)] mb-3">
        Partners here can get portal access to view deliveries and referrals. Invite or manage access from each partner&apos;s profile.
      </p>
      {partners.length === 0 ? (
        <div className="rounded-lg border border-[var(--brd)]/50 bg-[var(--card)]/50 px-4 py-6 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No realtor partners yet.</p>
          <Link
            href="/admin/clients/new?type=partner&partnerType=realtor"
            className="inline-block mt-2 text-[12px] font-semibold text-[var(--gold)] hover:underline"
          >
            Add Realtor Partner →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--brd)]/50 divide-y divide-[var(--brd)]/30">
          {partners.map((p) => (
            <Link
              key={p.id}
              href={`/admin/clients/${p.id}?from=realtors`}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--gold)] shrink-0">
                  {(p.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tx)] truncate">{p.name || "Unnamed"}</div>
                  {(p.contact_name || p.email) && (
                    <div className="text-[11px] text-[var(--tx3)] truncate">
                      {[p.contact_name, p.email].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-[var(--tx3)] shrink-0 ml-2">Manage portal →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
