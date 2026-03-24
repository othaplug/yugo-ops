import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id: shipmentId } = await params;
  const db = createAdminClient();
  const { data: row } = await db.from("inbound_shipments").select("id, inspection_photos").eq("id", shipmentId).single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
  const storagePath = `${shipmentId}/${safeName}`;

  const buf = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from("inbound-shipment-photos")
    .upload(storagePath, buf, { contentType: file.type || "image/jpeg", upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: urlData } = db.storage.from("inbound-shipment-photos").getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  const existing = Array.isArray(row.inspection_photos) ? row.inspection_photos : [];
  const nextPhotos = [...existing, url];

  const { error: upErr } = await db
    .from("inbound_shipments")
    .update({ inspection_photos: nextPhotos })
    .eq("id", shipmentId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ url, photos: nextPhotos });
}
