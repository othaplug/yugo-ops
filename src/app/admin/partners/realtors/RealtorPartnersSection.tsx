"use client";

import Link from "next/link";

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
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
