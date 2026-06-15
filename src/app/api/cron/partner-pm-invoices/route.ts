import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSendPmInvoice } from "@/lib/pm-invoicing";

/**
 * Vercel Cron: semi-monthly PM (property-management) invoicing.
 *
 * Runs daily but only acts on the two billing dates:
 *   - the 15th of the month
 *   - the last calendar day of the month (the "30th")
 *
 * On those days, for every property-management partner with billing_enabled =
 * true, it generates and SENDS (via Square, emailing the partner) one invoice
 * covering all unbilled completed PM moves. The due date equals the send date
 * (15th → due 15th; month-end → due that day), per generateAndSendPmInvoice.
 *
 * Gated on billing_enabled so nothing auto-sends until a partner is opted in.
 * Partners with no unbilled moves are skipped silently (409 from the helper).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const day = today.getDate();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const isBillingDay = day === 15 || day === lastDay;

  if (!isBillingDay) {
    return NextResponse.json({ skipped: true, reason: "not a billing day", day });
  }

  const sb = createAdminClient();
  const { data: partners, error } = await sb
    .from("organizations")
    .select("id, name, vertical, type, billing_enabled")
    .eq("billing_enabled", true)
    .or("vertical.ilike.property_management%,type.ilike.property_management%");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = {
    billingDate: today.toISOString().slice(0, 10),
    sent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const p of partners ?? []) {
    try {
      const r = await generateAndSendPmInvoice(sb, p.id, { now: today });
      if (r.ok && r.sent) {
        results.sent++;
      } else if (!r.ok && r.code === 409) {
        results.skipped++; // nothing unbilled — normal
      } else if (!r.ok) {
        results.errors.push(`${p.name}: ${r.error}`);
      } else {
        // ok but not sent (Square not configured) — surface as a soft error
        results.errors.push(`${p.name}: saved as draft (${r.warning ?? "not sent"})`);
      }
    } catch (e) {
      results.errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json(results);
}
