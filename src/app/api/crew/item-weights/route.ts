import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

// GET /api/crew/item-weights?q=dining+table&limit=8
// Fuzzy search against item_weights for the walkthrough extra-item search.
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "8", 10)));

  if (!q) return NextResponse.json({ items: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("item_weights")
    .select("id, item_name, slug, weight_score, category, num_people_min")
    .eq("active", true)
    .ilike("item_name", `%${q}%`)
    .order("is_common", { ascending: false })
    .order("display_order", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ items: [] });

  return NextResponse.json({ items: data ?? [] });
}
