"use client";

import { useState } from "react";
import B2BJobsDeliveryForm, {
  type B2BVerticalOption,
  type B2BJobsOrg,
  type B2BJobsCrew,
  type B2BJobsSubmitSuccess,
} from "@/components/admin/b2b/B2BJobsDeliveryForm";
import JobScopeSection, {
  type JobScope,
  type InboundShipmentDraft,
  EMPTY_INBOUND_DRAFT,
  scopeRequiresInbound,
} from "@/app/admin/quotes/new/JobScopeSection";

/**
 * Wrapper around the 3624-line B2BJobsDeliveryForm. Adds the R1 job
 * scope picker on top so coordinators creating a B2B one-off (Fritz
 * Hansen / wholesale / drop-ship pattern) can capture inbound-shipment
 * details inline.
 *
 * R1 Part 2: wired. When the B2B form's submit succeeds, we POST to
 * either /api/admin/inbound-shipments (delivery path → FK delivery_id)
 * or /api/admin/quotes/{id}/link-inbound-shipment (quote path) so the
 * inbound_shipments row exists and is linked back to the new row.
 * Failures are non-blocking — they log and let the form continue to
 * navigate so the operator can fix manually on the resulting page.
 */
export default function B2BOneOffDeliveryForm({
  crews = [],
  organizations = [],
  verticals = [],
}: {
  crews?: B2BJobsCrew[];
  organizations?: B2BJobsOrg[];
  verticals?: B2BVerticalOption[];
}) {
  const [jobScope, setJobScope] = useState<JobScope>("direct_delivery");
  const [inboundDraft, setInboundDraft] = useState<InboundShipmentDraft>(
    EMPTY_INBOUND_DRAFT,
  );

  /** Build the inbound payload shared by both delivery and quote paths. */
  const buildInboundPayload = () => {
    const declaredValNum = inboundDraft.declared_value
      ? Number(inboundDraft.declared_value)
      : null;
    const originPrefix = inboundDraft.origin_country.trim()
      ? `Origin: ${inboundDraft.origin_country.trim()}.`
      : "";
    const scopeNote =
      jobScope === "receive_and_recover"
        ? "Scope: receive + deliver + recover original (swap)."
        : "Scope: receive at warehouse + deliver.";
    const combinedInstructions = [
      originPrefix,
      scopeNote,
      inboundDraft.special_instructions.trim(),
    ]
      .filter(Boolean)
      .join(" ");
    return {
      carrier_name: inboundDraft.carrier_name.trim() || null,
      carrier_tracking_number:
        inboundDraft.carrier_tracking_number.trim() || null,
      carrier_eta: inboundDraft.carrier_eta || null,
      // origin_country is already folded into combinedInstructions; if
      // we also passed it as a top-level field the link endpoint would
      // double-prefix "Origin: …" onto special_instructions.
      special_instructions: combinedInstructions || null,
      service_level: "white_glove" as const,
      requires_assembly: false,
      requires_debris_removal: false,
      ...(declaredValNum != null && Number.isFinite(declaredValNum)
        ? { declared_value: declaredValNum }
        : {}),
    };
  };

  const handleSubmitSuccess = async (result: B2BJobsSubmitSuccess) => {
    if (!scopeRequiresInbound(jobScope)) return;
    const carrier = inboundDraft.carrier_name.trim();
    const tracking = inboundDraft.carrier_tracking_number.trim();
    if (!carrier && !tracking) return; // Nothing to link
    const inbound = buildInboundPayload();
    try {
      if (result.kind === "delivery") {
        await fetch("/api/admin/inbound-shipments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delivery_id: result.id,
            allow_empty_items: true,
            ...inbound,
          }),
        });
      } else {
        // Quote path
        await fetch(
          `/api/admin/quotes/${encodeURIComponent(result.id)}/link-inbound-shipment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(inbound),
          },
        );
      }
    } catch (err) {
      console.warn(
        "[B2BOneOffDeliveryForm] inbound link failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  return (
    <div className="space-y-4">
      <JobScopeSection
        value={jobScope}
        onChange={setJobScope}
        inbound={inboundDraft}
        onInboundChange={setInboundDraft}
      />
      <B2BJobsDeliveryForm
        crews={crews}
        organizations={organizations}
        verticals={verticals}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </div>
  );
}
