"use client";

import B2BJobsDeliveryForm, {
  type B2BVerticalOption,
  type B2BJobsOrg,
  type B2BJobsCrew,
} from "@/components/admin/b2b/B2BJobsDeliveryForm";

export default function B2BOneOffDeliveryForm({
  crews = [],
  organizations = [],
  verticals = [],
}: {
  crews?: B2BJobsCrew[];
  organizations?: B2BJobsOrg[];
  verticals?: B2BVerticalOption[];
}) {
  return <B2BJobsDeliveryForm crews={crews} organizations={organizations} verticals={verticals} />;
}
