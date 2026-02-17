import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("client_documents")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (doc?.storage_path) {
      await admin.storage.from("client-documents").remove([doc.storage_path]);
    }

    const { error } = await admin.from("client_documents").delete().eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
