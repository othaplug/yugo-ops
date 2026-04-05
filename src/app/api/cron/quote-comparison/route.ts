import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runQuoteComparisonCron } from "@/lib/quotes/comparison-intelligence";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();
  const result = await runQuoteComparisonCron(sb);
  return NextResponse.json({ ok: true, ...result });
}
