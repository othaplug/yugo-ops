/** Resolve delivery row contact fields for dispatch / calendar (customer → B2B contact → end customer). */

export function deliveryContactPhone(d: {
  customer_phone?: string | null;
  contact_phone?: string | null;
  end_customer_phone?: string | null;
}): string | null {
  const p =
    (d.customer_phone || "").trim() ||
    (d.contact_phone || "").trim() ||
    (d.end_customer_phone || "").trim();
  return p || null;
}

export function deliveryContactEmail(d: {
  customer_email?: string | null;
  contact_email?: string | null;
  end_customer_email?: string | null;
}): string | null {
  const e =
    (d.customer_email || "").trim() ||
    (d.contact_email || "").trim() ||
    (d.end_customer_email || "").trim();
  return e || null;
}
