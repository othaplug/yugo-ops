import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

const CATEGORIES = ["protection", "tools", "moving", "supplies", "tech"] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

/** GET: full equipment catalog (coordinator+) */
export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment_inventory")
    .select("id, name, category, icon, default_quantity, replacement_cost, is_consumable, active, created_at")
    .order("category")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST: create catalog item (manager+) */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const name = (body.name || "").toString().trim();
  const category = (body.category || "").toString().trim();
  const icon = body.icon != null ? String(body.icon).trim() || null : null;
  const default_quantity = Math.max(0, Math.floor(Number(body.default_quantity) || 1));
  const replacement_cost =
    body.replacement_cost != null && body.replacement_cost !== "" ? Number(body.replacement_cost) : null;
  const is_consumable = !!body.is_consumable;
  const active = body.active !== false;

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!isCategory(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment_inventory")
    .insert({
      name,
      category,
      icon,
      default_quantity,
      replacement_cost: replacement_cost != null && Number.isFinite(replacement_cost) ? replacement_cost : null,
      is_consumable,
      active,
    })
    .select(
      "id, name, category, icon, default_quantity, replacement_cost, is_consumable, active, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An item with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

/** PATCH: update catalog item (manager+) */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const id = (body.id || "").toString().trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.name != null) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    updates.name = n;
  }
  if (body.category != null) {
    const c = String(body.category).trim();
    if (!isCategory(c)) {
      return NextResponse.json(
        { error: `category must be one of: ${CATEGORIES.join(", ")}` },
        { status: 400 },
      );
    }
    updates.category = c;
  }
  if (body.icon !== undefined) updates.icon = body.icon ? String(body.icon).trim() : null;
  if (body.default_quantity != null) {
    updates.default_quantity = Math.max(0, Math.floor(Number(body.default_quantity) || 0));
  }
  if (body.replacement_cost !== undefined) {
    const v = body.replacement_cost;
    updates.replacement_cost =
      v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  }
  if (body.is_consumable != null) updates.is_consumable = !!body.is_consumable;
  if (body.active != null) updates.active = !!body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment_inventory")
    .update(updates)
    .eq("id", id)
    .select(
      "id, name, category, icon, default_quantity, replacement_cost, is_consumable, active, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An item with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
