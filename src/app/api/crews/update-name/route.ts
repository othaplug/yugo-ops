import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const { crewId, name } = await req.json();

    if (!crewId || typeof crewId !== "string") {
      return NextResponse.json(
        { error: "crewId is required" },
        { status: 400 },
      );
    }
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Crew name is required" },
        { status: 400 },
      );
    }

    const trimmed = name.trim();
    const supabase = await createClient();

    const { data: before, error: fetchError } = await supabase
      .from("crews")
      .select("name")
      .eq("id", crewId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message || "Crew not found" },
        { status: 400 },
      );
    }
    if (!before) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    const previousName = String(before.name ?? "").trim() || "Unnamed crew";
    if (previousName === trimmed) {
      return NextResponse.json({ ok: true, name: trimmed, unchanged: true });
    }

    const { error } = await supabase
      .from("crews")
      .update({ name: trimmed })
      .eq("id", crewId);

    if (error) {
      const msg = error.message || "Failed to update";
      if (/unique|duplicate/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "A crew with that name already exists. Choose a different name.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    void logActivity({
      entity_type: "crew",
      entity_id: crewId,
      event_type: "crew_renamed",
      description: `Crew renamed: "${previousName}" → "${trimmed}"`,
      icon: "crew",
    });

    return NextResponse.json({ ok: true, name: trimmed });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}
