import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * GET /api/admin/quotes/[quoteId]/versions
 *
 * Returns the version history snapshots for a quote.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  try {
    const { error: authError } = await requireStaff();
    if (authError) return authError;

    const { quoteId } = await params;
    const supabase = createAdminClient();

    /* ── Resolve UUID from quote_id string ── */
    const { data: quoteRow, error: qErr } = await supabase
      .from("quotes")
      .select("id")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (qErr || !quoteRow) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    /* ── Fetch version snapshots ── */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: versions, error: vErr } = await (supabase as any)
      .from("quote_versions")
      .select("version_number, created_at, snapshot, regenerated_by")
      .eq("quote_id", quoteRow.id)
      .order("version_number", { ascending: false });

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }

    return NextResponse.json({ versions: versions ?? [] });
  } catch (e) {
    console.error("[quotes/versions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
