import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, photoId } = await params;
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!platformUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: photo } = await supabase
      .from("move_photos")
      .select("storage_path")
      .eq("id", photoId)
      .eq("move_id", moveId)
      .single();

    if (photo?.storage_path) {
      await supabase.storage.from("move-photos").remove([photo.storage_path]);
    }

    await supabase.from("move_photos").delete().eq("id", photoId).eq("move_id", moveId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
