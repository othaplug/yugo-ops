"use client"

import { useState } from "react"
import Link from "next/link"
import { InfoHint } from "@/components/ui/InfoHint"
import { organizationTypeLabel } from "@/lib/partner-type"
import { Button } from "@/design-system/admin/primitives"
import AddReferringPartnerModal, { AddReferringPartnerTriggerButton } from "./AddReferringPartnerModal"

export type ReferralOrgPartner = {
  id: string
  name: string | null
  contact_name?: string | null
  email?: string | null
  type?: string | null
}

export default function RealtorPartnersSection({ partners }: { partners: ReferralOrgPartner[] }) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <section className="min-w-0" aria-labelledby="referral-orgs-heading">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2
            id="referral-orgs-heading"
            className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]"
          >
            Referral partner organizations
          </h2>
          <InfoHint variant="admin" ariaLabel="About referral partner organizations">
            <p className="text-[12px] leading-relaxed text-[var(--yu3-ink)]">
              Organization records for realtors, property managers, and developers (commissions and referral
              pipeline). Portal access and login invites are managed per organization. Individual realtor contacts for
              the pipeline are below. Use{" "}
              <span className="font-semibold text-[var(--yu3-ink-strong)]">Add Realtor</span> for those contacts.
            </p>
          </InfoHint>
        </div>
        <AddReferringPartnerTriggerButton onClick={() => setAddOpen(true)} />
      </div>
      <AddReferringPartnerModal open={addOpen} onClose={() => setAddOpen(false)} />

      {partners.length === 0 ? (
        <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-4 py-6 text-center">
          <p className="text-[13px] text-[var(--yu3-ink-muted)]">
            No referral partner organizations yet.
          </p>
          <Button
            type="button"
            variant="link"
            className="mt-2 h-auto p-0 text-[13px] font-semibold text-[var(--yu3-wine)] hover:text-[var(--yu3-wine-hover)]"
            onClick={() => setAddOpen(true)}
          >
            Add referring partner
          </Button>
        </div>
      ) : (
        <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] overflow-hidden divide-y divide-[var(--yu3-line-subtle)]">
          {partners.map((p) => {
            const typeKey = (p.type || "").trim()
            const typeLabel = typeKey ? organizationTypeLabel(typeKey) : null
            return (
              <Link
                key={p.id}
                href={`/admin/clients/${p.id}?from=realtors`}
                className="flex items-center justify-between px-4 py-3.5 gap-3 transition-colors hover:bg-[var(--yu3-bg-surface-sunken)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[var(--yu3-r-md)] bg-[var(--yu3-wine-tint)] flex items-center justify-center text-[12px] font-bold text-[var(--yu3-wine)] shrink-0">
                    {(p.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                      {p.name || "Unnamed"}
                    </div>
                    <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                      {[typeLabel, p.contact_name, p.email].filter(Boolean).join(" \u00b7 ")}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--yu3-ink-muted)] shrink-0">Manage</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
