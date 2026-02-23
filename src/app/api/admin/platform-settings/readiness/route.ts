import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

const DEFAULT_ITEMS = [
  { label: "Truck in good condition" },
  { label: "Equipment & supplies ready" },
  { label: "Dolly, straps, blankets" },
  { label: "First aid kit accessible" },
  { label: "Fuel level adequate" },
];

/** GET: Readiness checklist items from platform_settings */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("readiness_items")
    .eq("id", "default")
    .maybeSingle();

  const raw = (data as { readiness_items?: unknown })?.readiness_items;
  const items = Array.isArray(raw)
    ? raw
        .filter((x) => x && typeof x === "object" && "label" in x)
        .map((x) => ({ label: String((x as { label: string }).label) }))
    : DEFAULT_ITEMS;

  return NextResponse.json({ items });
}

/** PATCH: Update readiness checklist items */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const body = await req.json();
  const items = Array.isArray(body.items)
    ? body.items
        .filter((x: unknown) => x && typeof x === "object" && "label" in x)
        .map((x: { label: string }) => ({ label: String(x.label).trim() }))
        .filter((x: { label: string }) => x.label)
    : null;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "At least one item with label required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .update({ readiness_items: items, updated_at: new Date().toISOString() })
    .eq("id", "default");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items });
}
