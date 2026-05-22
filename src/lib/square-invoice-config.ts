import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_BILLING_CONTACT,
  type BillingContact,
} from "@/lib/square-invoice-builders";

/**
 * Loads invoice billing contact info (banking, emails, HST registration) from
 * platform_config. Missing keys fall back to DEFAULT_BILLING_CONTACT so the
 * helper never returns a half-populated invoice. The defaults are also what
 * the platform_config migration seeds, so prod and dev stay in sync.
 *
 * Result is intentionally not cached at module scope — these reads are cheap
 * (8 keys, single table) and we want a config change to take effect on the
 * next invoice without a server restart. Heavier batched paths can pass a
 * pre-loaded BillingContact via input.billingContact to bypass this.
 */
export async function getInvoiceBillingContact(): Promise<BillingContact> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", [
        "hst_registration_number",
        "billing_email",
        "etransfer_email",
        "bank_name",
        "bank_account_number",
        "bank_transit_number",
        "bank_institution_number",
        "office_address",
        "credit_card_fee_pct",
      ]);

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      const r = row as { key?: string; value?: string };
      if (r.key) map[r.key] = (r.value ?? "").trim();
    }

    const pick = (k: string, fallback: string) => map[k] || fallback;

    return {
      hstRegistration: pick(
        "hst_registration_number",
        DEFAULT_BILLING_CONTACT.hstRegistration,
      ),
      billingEmail: pick("billing_email", DEFAULT_BILLING_CONTACT.billingEmail),
      etransferEmail: pick(
        "etransfer_email",
        DEFAULT_BILLING_CONTACT.etransferEmail,
      ),
      bankName: pick("bank_name", DEFAULT_BILLING_CONTACT.bankName),
      bankAccount: pick(
        "bank_account_number",
        DEFAULT_BILLING_CONTACT.bankAccount,
      ),
      bankTransit: pick(
        "bank_transit_number",
        DEFAULT_BILLING_CONTACT.bankTransit,
      ),
      bankInstitution: pick(
        "bank_institution_number",
        DEFAULT_BILLING_CONTACT.bankInstitution,
      ),
      officeAddress: pick(
        "office_address",
        DEFAULT_BILLING_CONTACT.officeAddress,
      ),
      creditCardFeePct: pick(
        "credit_card_fee_pct",
        DEFAULT_BILLING_CONTACT.creditCardFeePct,
      ),
    };
  } catch (err) {
    console.warn(
      "[square-invoice-config] platform_config read failed, using defaults:",
      err,
    );
    return DEFAULT_BILLING_CONTACT;
  }
}
