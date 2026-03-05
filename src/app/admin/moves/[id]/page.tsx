import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id?.trim() || "";
  const supabase = await createClient();
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    byUuid
      ? db.from("moves").select("*").eq("id", slug).single()
      : db.from("moves").select("*").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single(),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  if (byUuid && move.move_code?.trim()) {
    redirect(getMoveDetailPath(move));
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db.from("platform_users").select("role").eq("user_id", user?.id ?? "").single();
  const userRole = pu?.role ?? "viewer";

  const isOffice = move.move_type === "office";

  return <MoveDetailClient move={move} crews={crews ?? []} isOffice={isOffice} userRole={userRole} />;
}
