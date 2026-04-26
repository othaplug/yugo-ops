import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = createAdminClient();
  const { data: survey, error } = await sb
    .from("photo_surveys")
    .select(
      "id, status, client_name, coordinator_name, coordinator_phone, lead_id, photos, total_photos, special_notes",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ survey });
}
