import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const { crewId, members } = await req.json();

    if (!crewId || !Array.isArray(members)) {
      return NextResponse.json({ error: "crewId and members array required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("crews")
      .update({ members })
      .eq("id", crewId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update" }, { status: 500 });
  }
}
