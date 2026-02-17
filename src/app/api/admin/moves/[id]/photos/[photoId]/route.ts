import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, photoId } = await params;
    const admin = createAdminClient();
    const { data: photo } = await admin
      .from("move_photos")
      .select("storage_path")
      .eq("id", photoId)
      .eq("move_id", moveId)
      .single();

    if (photo?.storage_path) {
      await admin.storage.from("move-photos").remove([photo.storage_path]);
    }

    await admin.from("move_photos").delete().eq("id", photoId).eq("move_id", moveId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
