"use client";

import { useState } from "react";
import Link from "next/link";
import { InfoHint } from "@/components/ui/InfoHint";
import { organizationTypeLabel } from "@/lib/partner-type";
import AddReferringPartnerModal, { AddReferringPartnerTriggerButton } from "./AddReferringPartnerModal";

export type ReferralOrgPartner = {
  id: string;
  name: string | null;
  contact_name?: string | null;
  email?: string | null;
  type?: string | null;
};

export default function RealtorPartnersSection({ partners }: { partners: ReferralOrgPartner[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
            Referral partner organizations
          </h3>
          <InfoHint variant="admin" ariaLabel="About referral partner organizations">
            <p className="text-[12px] leading-relaxed">
              Organization records for realtors, property managers, and developers (commissions & referral
              pipeline). Portal access and login invites are managed per organization. Individual realtor contacts for
              the pipeline are below. Use{" "}
              <span className="font-semibold text-[var(--tx)]">Add Realtor</span> for those contacts.
            </p>
          </InfoHint>
        </div>
        <AddReferringPartnerTriggerButton onClick={() => setAddOpen(true)} />
      </div>
      <AddReferringPartnerModal open={addOpen} onClose={() => setAddOpen(false)} />

      {partners.length === 0 ? (
        <div className="rounded-lg border border-[var(--brd)]/50 bg-[var(--card)]/50 px-4 py-6 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No referral partner organizations yet.</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-block mt-2 text-[12px] font-semibold text-[var(--gold)] hover:underline"
          >
            Add referring partner
          </button>
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
