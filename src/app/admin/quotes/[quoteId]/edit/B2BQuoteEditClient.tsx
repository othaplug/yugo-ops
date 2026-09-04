"use client";

import { useMemo, useState } from "react";
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
import { buildB2bInitialDataFromQuote } from "@/lib/admin/b2b-quote-initial-data";

/**
 * Dedicated EDIT screen for a B2B (commercial delivery) quote. Renders the same
 * B2BJobsDeliveryForm as the full-page create surface (un-embedded, full width)
 * but with `quoteId` + `editMode`, so the form UPDATES the existing quote in
 * place instead of creating a new one — and none of the move-quote wizard's
 * nested cards, service-type step, or duplicate banners.
 *
 * Prefill is built from the source quote via the shared builder (same shape the
 * create wizard's edit-prefill produces). The inbound-shipment link mirror of
 * B2BOneOffDeliveryForm is kept so a scope change here still records inbound.
 */
export default function B2BQuoteEditClient({
  quoteId,
  quote,
  crews = [],
  organizations = [],
  verticals = [],
}: {
  quoteId: string;
  quote: Record<string, unknown>;
  crews?: B2BJobsCrew[];
  organizations?: B2BJobsOrg[];
  verticals?: B2BVerticalOption[];
}) {
  const initialData = useMemo(() => buildB2bInitialDataFromQuote(quote), [quote]);

  const initialScope = (() => {
    const fa = (quote.factors_applied ?? {}) as Record<string, unknown>;
    const s = String(fa.b2b_job_scope ?? "");
    return s === "receive_and_deliver" || s === "receive_and_recover"
      ? (s as JobScope)
      : ("direct_delivery" as JobScope);
  })();

  const [jobScope, setJobScope] = useState<JobScope>(initialScope);
  const [inboundDraft, setInboundDraft] =
    useState<InboundShipmentDraft>(EMPTY_INBOUND_DRAFT);

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
      carrier_tracking_number: inboundDraft.carrier_tracking_number.trim() || null,
      carrier_eta: inboundDraft.carrier_eta || null,
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
    if (!carrier && !tracking) return;
    const inbound = buildInboundPayload();
    try {
      if (result.kind === "delivery") {
        await fetch("/api/admin/inbound-shipments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivery_id: result.id, allow_empty_items: true, ...inbound }),
        });
      } else {
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
      console.warn("[B2BQuoteEditClient] inbound link failed", err instanceof Error ? err.message : err);
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
        quoteId={quoteId}
        editMode
        initialData={initialData}
        crews={crews}
        organizations={organizations}
        verticals={verticals}
        jobScope={jobScope}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </div>
  );
}
