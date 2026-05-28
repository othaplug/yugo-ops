"use client";

import { useState } from "react";
import B2BJobsDeliveryForm, {
  type B2BVerticalOption,
  type B2BJobsOrg,
  type B2BJobsCrew,
} from "@/components/admin/b2b/B2BJobsDeliveryForm";
import JobScopeSection, {
  type JobScope,
  type InboundShipmentDraft,
  EMPTY_INBOUND_DRAFT,
} from "@/app/admin/quotes/new/JobScopeSection";

/**
 * Wrapper around the 3624-line B2BJobsDeliveryForm. Adds the R1 job
 * scope picker on top so coordinators creating a B2B one-off (Fritz
 * Hansen / wholesale / drop-ship pattern) can capture inbound-shipment
 * details inline.
 *
 * Scope state is local to this wrapper for Part 1 (visual only). Part
 * 2 will plumb the state into the B2B form's submit handler so the
 * inbound_shipments row is created and linked when the delivery /
 * quote is saved.
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
      />
    </div>
  );
}
