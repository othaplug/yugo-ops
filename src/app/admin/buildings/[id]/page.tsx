import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BuildingEditorClient from "../BuildingEditorClient";

export const dynamic = "force-dynamic";

export default async function EditBuildingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data } = await db.from("building_profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <BuildingEditorClient initial={data} />;
}
