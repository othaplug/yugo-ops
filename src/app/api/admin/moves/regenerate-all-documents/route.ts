import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { generateMovePDFs } from "@/lib/documents/generateMovePDFs";
import { canRegenerateMoveDocuments } from "@/lib/move-status";
import { isSuperAdminEmail } from "@/lib/super-admin";

export const maxDuration = 300;

/**
 * Rebuild Move Summary / Invoice / Receipt PDFs for every move whose
 * status makes them eligible. Used after a PDF template redesign — the
 * old PDFs live in Supabase Storage and only get overwritten when the
 * generator runs for that specific move.
 *
 * Super-admin only; the loop can touch every move on the platform.
 * Errors on individual moves are collected + returned so a single
 * failure doesn't halt the whole batch.
 */
export async function POST(req: Request) {
  const { user, error: authError } = await requireStaff();
  if (authError) return authError;
  if (!isSuperAdminEmail(user?.email)) {
    return NextResponse.json(
      { error: "Super-admin only" },
      { status: 403 },
    );
  }

  // Optional body: { limit?: number, sinceDate?: string, moveIds?: string[] }
  let body: { limit?: number; sinceDate?: string; moveIds?: string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* body optional */
  }

  const admin = createAdminClient();
  let query = admin
    .from("moves")
    .select("id, move_code, status, completed_at")
    .order("completed_at", { ascending: false })
    .limit(Math.min(1000, Math.max(1, body.limit ?? 500)));

  if (body.moveIds && body.moveIds.length > 0) {
    query = query.in("id", body.moveIds);
  } else if (body.sinceDate) {
    query = query.gte("completed_at", body.sinceDate);
  }

  const { data: moves, error: listErr } = await query;
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const eligible = (moves ?? []).filter((m) =>
    canRegenerateMoveDocuments(String(m.status ?? "")),
  );

  const results: Array<{
    move_id: string;
    move_code: string | null;
    ok: boolean;
    error?: string;
  }> = [];

  // Sequential to keep memory + storage upload load predictable. jsPDF
  // holds the whole document in memory; 3 PDFs × parallelism would
  // pressure the serverless function's 1 GB heap on large inventories.
  for (const m of eligible) {
    try {
      await generateMovePDFs(m.id as string);
      results.push({ move_id: m.id as string, move_code: m.move_code, ok: true });
    } catch (e) {
      results.push({
        move_id: m.id as string,
        move_code: m.move_code,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: true,
    scanned: moves?.length ?? 0,
    eligible: eligible.length,
    succeeded,
    failed: failed.length,
    failures: failed,
  });
}
