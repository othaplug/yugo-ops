"use client";

import Link from "next/link";
import { organizationTypeLabel } from "@/lib/partner-type";

export type ReferralOrgPartner = {
  id: string;
  name: string | null;
  contact_name?: string | null;
  email?: string | null;
  type?: string | null;
};

const ADD_BASE = "/admin/clients/new?type=partner";

export default function RealtorPartnersSection({ partners }: { partners: ReferralOrgPartner[] }) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
          Referral partner organizations
        </h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${ADD_BASE}&partnerType=realtor`}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all whitespace-nowrap"
          >
            Add realtor org
          </Link>
          <Link
            href={`${ADD_BASE}&partnerType=property_manager`}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]/50 transition-all whitespace-nowrap"
          >
            Add property manager
          </Link>
          <Link
            href={`${ADD_BASE}&partnerType=developer`}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]/50 transition-all whitespace-nowrap"
          >
            Add developer
          </Link>
        </div>
      </div>
      <p className="text-[11px] text-[var(--tx3)] mb-3 max-w-2xl leading-relaxed">
        Organization records for realtors, property managers, and developers (commissions &amp; referral pipeline).
        Portal access and login invites are managed per organization. Individual realtor contacts for the pipeline are
        below — use <span className="text-[var(--tx2)] font-medium">Add Realtor</span> for those.
      </p>
      {partners.length === 0 ? (
        <div className="rounded-lg border border-[var(--brd)]/50 bg-[var(--card)]/50 px-4 py-6 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No referral partner organizations yet.</p>
          <Link
            href={`${ADD_BASE}&partnerType=realtor`}
            className="inline-block mt-2 text-[12px] font-semibold text-[var(--gold)] hover:underline"
          >
            Add realtor organization
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--brd)]/50 divide-y divide-[var(--brd)]/30">
          {partners.map((p) => {
            const typeKey = (p.type || "").trim();
            const typeLabel = typeKey ? organizationTypeLabel(typeKey) : null;
            return (
              <Link
                key={p.id}
                href={`/admin/clients/${p.id}?from=realtors`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--gold)] shrink-0">
                    {(p.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--tx)] truncate">{p.name || "Unnamed"}</div>
                    <div className="text-[11px] text-[var(--tx3)] truncate">
                      {[typeLabel, p.contact_name, p.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--tx3)] shrink-0">Manage</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
