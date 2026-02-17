import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, docId } = await params;
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("move_documents")
      .select("storage_path")
      .eq("id", docId)
      .eq("move_id", moveId)
      .single();

    if (doc?.storage_path) {
      await admin.storage.from("move-documents").remove([doc.storage_path]);
    }

    await admin.from("move_documents").delete().eq("id", docId).eq("move_id", moveId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
