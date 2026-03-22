import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { getDueFollowupsPreview } from "@/lib/quote-followups/due-preview";

/** GET — quotes that would get follow-up 1/2/3 on the next batch run (same filters as cron). */
export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  try {
    const items = await getDueFollowupsPreview();
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Preview failed" },
      { status: 500 },
    );
  }
}
