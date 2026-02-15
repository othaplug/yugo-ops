import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MoveDetailClient from "./MoveDetailClient";

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: move, error } = await supabase
    .from("moves")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !move) notFound();

  const isOffice = move.move_type === "office";

  return <MoveDetailClient move={move} isOffice={isOffice} />;
}
