import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MoveDetailClient from "./MoveDetailClient";

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    supabase.from("moves").select("*").eq("id", id).single(),
    supabase.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  const isOffice = move.move_type === "office";

  return <MoveDetailClient move={move} crews={crews ?? []} isOffice={isOffice} />;
}
