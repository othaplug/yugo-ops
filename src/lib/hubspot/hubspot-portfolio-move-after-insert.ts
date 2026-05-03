import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getMoveDetailPath } from "@/lib/move-code";
import { autoCreateHubSpotDealForNewMove } from "@/lib/hubspot/auto-create-deal-for-move";

/**
 * PM portfolio moves skip `/admin/moves/create`, so they never hit the HubSpot path there.
 * Creates one OPS-pipeline deal per move. Uses tenant email when present; otherwise partner billing / org email.
 * Skips duplicate contact checks so multiple jobs can share partner billing inbox without collapsing to one deal.
 */
export async function hubspotPortfolioMoveDealAfterInsert(
  sb: SupabaseClient,
  opts: {
    moveId: string;
    moveCode: string | null | undefined;
    tenantEmail: string | null | undefined;
    partnerBillingEmail?: string | null | undefined;
    partnerOrgEmail?: string | null | undefined;
    displayName: string;
    tenantPhone?: string | null | undefined;
    serviceType?: string | null;
    moveSize?: string | null;
    scheduledDate?: string | null;
    fromAddress?: string | null;
    toAddress?: string | null;
    fromAccess?: string | null;
    toAccess?: string | null;
    estimate?: number | null;
    tierSelected?: string | null;
  },
): Promise<void> {
  if (!process.env.HUBSPOT_ACCESS_TOKEN?.trim()) return;

  const contactEmail =
    String(opts.tenantEmail || "").trim() ||
    String(opts.partnerBillingEmail || "").trim() ||
    String(opts.partnerOrgEmail || "").trim();

  if (!contactEmail) {
    console.warn(
      `[HubSpot] Skipping portfolio move deal: no tenant or partner email (move ${opts.moveCode || opts.moveId}).`,
    );
    return;
  }

  const display = String(opts.displayName || "").trim() || "Tenant";
  const nameParts = display.split(/\s+/);
  const firstName = nameParts[0]?.trim() || "Portfolio";
  const lastName = nameParts.slice(1).join(" ").trim() || "move";

  const base = getEmailBaseUrl().replace(/\/$/, "");
  const path = getMoveDetailPath({ move_code: opts.moveCode, id: opts.moveId });
  const moveAdminUrl = `${base}${path}`;
  const refCode = String(opts.moveCode || "").trim() || opts.moveId;

  try {
    const created = await autoCreateHubSpotDealForNewMove({
      sb,
      move: {
        id: opts.moveId,
        service_type: opts.serviceType ?? "b2b_oneoff",
        move_size: opts.moveSize ?? null,
        scheduled_date: opts.scheduledDate ?? null,
        from_address: opts.fromAddress ?? null,
        to_address: opts.toAddress ?? null,
        from_access: opts.fromAccess ?? null,
        to_access: opts.toAccess ?? null,
        estimate: opts.estimate ?? null,
        tier_selected: opts.tierSelected ?? null,
      },
      moveCode: refCode,
      clientEmail: contactEmail,
      firstName,
      lastName,
      clientPhone: opts.tenantPhone ?? null,
      moveAdminUrl,
      skipDuplicateCheck: true,
    });

    if (created?.status === "created" && created.dealId) {
      await sb.from("moves").update({ hubspot_deal_id: created.dealId }).eq("id", opts.moveId);
    } else if (created?.status === "duplicate") {
      console.warn(
        `[HubSpot] Unexpected duplicate for portfolio move ${refCode} (skipDuplicateCheck=true).`,
      );
    } else if (created == null) {
      console.error(`[HubSpot] Portfolio move deal creation failed (${refCode})`);
    }
  } catch (e) {
    console.error(`[HubSpot] Portfolio move deal error (${refCode}):`, e);
  }
}
