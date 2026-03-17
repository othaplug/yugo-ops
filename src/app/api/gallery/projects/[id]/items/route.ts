import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

const CONDITION_VALUES = ["excellent", "good", "fair", "poor", "damaged"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { id: projectId } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("gallery_project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { id: projectId } = await params;
  const body = await req.json();
  const {
    title,
    artist,
    medium,
    dimensions,
    weight_kg,
    serial_number,
    insurance_value,
    crating_required,
    climate_sensitive,
    fragile,
    handling_notes,
    sort_order,
  } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Item title is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    project_id: projectId,
    title: title.trim(),
    updated_at: new Date().toISOString(),
  };
  if (artist) row.artist = String(artist).trim() || null;
  if (medium) row.medium = String(medium).trim() || null;
  if (dimensions) row.dimensions = String(dimensions).trim() || null;
  if (weight_kg != null) row.weight_kg = Number(weight_kg);
  if (serial_number) row.serial_number = String(serial_number).trim() || null;
  if (insurance_value) row.insurance_value = String(insurance_value).trim() || null;
  if (typeof crating_required === "boolean") row.crating_required = crating_required;
  if (typeof climate_sensitive === "boolean") row.climate_sensitive = climate_sensitive;
  if (typeof fragile === "boolean") row.fragile = fragile;
  if (handling_notes) row.handling_notes = String(handling_notes).trim() || null;
  if (sort_order != null) row.sort_order = Number(sort_order);

  const { data, error } = await admin
    .from("gallery_project_items")
    .insert(row)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { id: projectId } = await params;
  const body = await req.json();
  const { itemId, ...fields } = body;

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const allowedFields = [
    "title", "artist", "medium", "dimensions", "weight_kg", "serial_number",
    "insurance_value", "crating_required", "climate_sensitive", "fragile",
    "handling_notes", "sort_order",
    "pre_condition", "pre_condition_notes", "pre_condition_photos",
    "pre_condition_at", "pre_condition_by",
    "post_condition", "post_condition_notes", "post_condition_photos",
    "post_condition_at", "post_condition_by",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (key in fields) {
      if ((key === "pre_condition" || key === "post_condition") && fields[key] != null) {
        if (!CONDITION_VALUES.includes(fields[key])) continue;
      }
      updates[key] = fields[key];
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gallery_project_items")
    .update(updates)
    .eq("id", itemId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { id: projectId } = await params;
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("gallery_project_items")
    .delete()
    .eq("id", itemId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
