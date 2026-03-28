import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAllAdmins } from "@/lib/notifications";

/**
 * Flags orphaned / inconsistent rows (no deletes). Weekly digest to coordinators.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  const { count: quotesNoContact } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .is("contact_id", null)
    .in("status", ["sent", "viewed", "reactivated"]);

  if (quotesNoContact && quotesNoContact > 0) {
    lines.push(`${quotesNoContact} quote(s) have no linked contact — review in admin.`);
  }

  const { count: movesNoCrew } = await admin
    .from("moves")
    .select("id", { count: "exact", head: true })
    .is("crew_id", null)
    .eq("scheduled_date", today)
    .in("status", ["confirmed", "scheduled", "paid"]);

  if (movesNoCrew && movesNoCrew > 0) {
    lines.push(`${movesNoCrew} move(s) scheduled today with no crew assigned.`);
  }

  const { count: movesPastNoCrew } = await admin
    .from("moves")
    .select("id", { count: "exact", head: true })
    .is("crew_id", null)
    .lt("scheduled_date", today)
    .in("status", ["confirmed", "scheduled", "paid", "in_progress"]);

  if (movesPastNoCrew && movesPastNoCrew > 0) {
    lines.push(`${movesPastNoCrew} move(s) past scheduled date still have no crew — review in admin.`);
  }

  if (lines.length > 0) {
    await notifyAllAdmins({
      title: "Weekly data integrity check",
      body: lines.join("\n"),
      icon: "clipboard",
      sourceType: "cron",
      sourceId: "data-integrity-weekly",
    });
  }

  return NextResponse.json({ flagged: lines.length, lines });
}
