import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { generateMovePDFs } from "@/lib/documents/generateMovePDFs";
import { canRegenerateMoveDocuments } from "@/lib/move-status";

/**
 * Regenerate Move Summary, Invoice, and Receipt PDFs for a finished or fully paid move.
 * Admin only. Useful when move data was corrected after completion or payment.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId } = await params;
  const admin = createAdminClient();
  const { data: move, error } = await admin
    .from("moves")
    .select("id, status")
    .eq("id", moveId)
    .single();

  if (error || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
  const status = (move as { status?: string }).status;
  if (!canRegenerateMoveDocuments(status)) {
    return NextResponse.json(
      {
        error:
          "Documents can only be regenerated after the move is completed, delivered, or fully paid",
      },
      { status: 400 },
    );
  }

  try {
    const paths = await generateMovePDFs(moveId);
    return NextResponse.json({ success: true, ...paths });
  } catch (e) {
    console.error("[regenerate-documents]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to regenerate documents" },
      { status: 500 }
    );
  }
}
