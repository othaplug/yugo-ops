import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    const { data: move } = await supabase
      .from("moves")
      .select("id, crew_id")
      .eq("id", moveId)
      .ilike("client_email", email)
      .single();

    if (!move || !move.crew_id) {
      return NextResponse.json({ crew: null, eta: null });
    }

    const admin = createAdminClient();
    const { data: crew } = await admin
      .from("crews")
      .select("id, name, current_lat, current_lng, delay_minutes, status, updated_at")
      .eq("id", move.crew_id)
      .single();

    if (!crew) return NextResponse.json({ crew: null, eta: null });

    const hasPosition = crew.current_lat != null && crew.current_lng != null;
    let eta: string | null = null;
    if (crew.delay_minutes != null && crew.delay_minutes > 0) {
      eta = `~${crew.delay_minutes} min`;
    } else if (hasPosition && crew.status === "en-route") {
      eta = "En route";
    } else if (crew.status) {
      eta = crew.status.replace("-", " ");
    }

    return NextResponse.json({
      crew: hasPosition
        ? {
            current_lat: crew.current_lat,
            current_lng: crew.current_lng,
            name: crew.name,
          }
        : null,
      crewName: crew.name,
      eta,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
