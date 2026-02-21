import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

/** DELETE a crew/team. Fails if the crew is assigned to any moves or deliveries. */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const { crewId } = await req.json();
    if (!crewId) return NextResponse.json({ error: "crewId required" }, { status: 400 });

    const supabase = await createClient();

    const { data: moves } = await supabase.from("moves").select("id").eq("crew_id", crewId).limit(1);
    if (moves?.length) {
      return NextResponse.json(
        { error: "Cannot delete: this team is assigned to one or more moves. Reassign or remove assignments first." },
        { status: 400 }
      );
    }
    const { data: deliveries } = await supabase.from("deliveries").select("id").eq("crew_id", crewId).limit(1);
    if (deliveries?.length) {
      return NextResponse.json(
        { error: "Cannot delete: this team is assigned to one or more deliveries. Reassign or remove assignments first." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("crews").delete().eq("id", crewId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete" }, { status: 500 });
  }
}
