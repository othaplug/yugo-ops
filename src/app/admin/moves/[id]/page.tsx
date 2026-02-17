import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id?.trim() || "";
  const supabase = await createClient();
  const byUuid = isMoveIdUuid(slug);
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    byUuid
      ? supabase.from("moves").select("*").eq("id", slug).single()
      : supabase.from("moves").select("*").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single(),
    supabase.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  // Redirect UUID URLs to canonical short URL so the address bar shows /admin/moves/MV3456
  if (byUuid && move.move_code?.trim()) {
    redirect(getMoveDetailPath(move));
  }

  const isOffice = move.move_type === "office";

  return <MoveDetailClient move={move} crews={crews ?? []} isOffice={isOffice} />;
}
