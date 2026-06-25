/**
 * POST /api/admin/outbound-shipments/[id]/photos
 *
 * Body: multipart/form-data with:
 *   • file   — the image
 *   • bucket — which photo column to push the URL onto. Must be one of:
 *              'pickup' | 'intake' | 'palletized' | 'handoff'
 *
 * Per-bucket arrays are stored on the row as JSONB:
 *   pickup_photos, intake_photos, palletized_photos, handoff_photos
 *
 * Mirrors the inbound-shipments photo upload pattern but with a richer
 * bucket field so the photo lands in the right gate-evidence column.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET_TO_COLUMN: Record<string, string> = {
  pickup: "pickup_photos",
  intake: "intake_photos",
  palletized: "palletized_photos",
  handoff: "handoff_photos",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const bucket = String(formData.get("bucket") ?? "").trim().toLowerCase();

  if (!file?.size) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const column = BUCKET_TO_COLUMN[bucket];
  if (!column) {
    return NextResponse.json(
      {
        error: `Invalid bucket '${bucket}'. Must be one of: ${Object.keys(BUCKET_TO_COLUMN).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  // Fetch the full row to read the per-bucket photo column dynamically.
  // The select() generic types don't allow a runtime column name, so we
  // pay one extra column-read per upload for the typing win.
  const { data: rowRaw } = await db
    .from("outbound_shipments")
    .select("*")
    .or(`id.eq.${id},shipment_number.eq.${id}`)
    .maybeSingle();
  if (!rowRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = rowRaw as Record<string, unknown> & { id: string };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
  const storagePath = `${row.id}/${bucket}/${safeName}`;

  const buf = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from("outbound-shipment-photos")
    .upload(storagePath, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: urlData } = db.storage
    .from("outbound-shipment-photos")
    .getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  const existingRaw = row[column];
  const existing = Array.isArray(existingRaw)
    ? (existingRaw as Array<{ url: string; uploaded_at: string }>)
    : [];
  const nextPhotos = [...existing, { url, uploaded_at: new Date().toISOString() }];

  const { error: upErr } = await db
    .from("outbound_shipments")
    .update({ [column]: nextPhotos })
    .eq("id", row.id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ url, photos: nextPhotos });
}
