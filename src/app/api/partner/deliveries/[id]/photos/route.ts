import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { isUuid } from "@/lib/move-code";

const BUCKET = "job-photos";

/** Partner-scoped delivery photos (crew photos from job). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id, organization_id").eq("id", slug).single()
    : await admin.from("deliveries").select("id, organization_id").ilike("delivery_number", slug).single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (!delivery.organization_id || !orgIds.includes(delivery.organization_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: photos, error: dbError } = await admin
    .from("job_photos")
    .select("id, storage_path, thumbnail_path, category, checkpoint, taken_at, note")
    .eq("job_id", delivery.id)
    .eq("job_type", "delivery")
    .order("taken_at", { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const urls: { id: string; url: string; category: string; checkpoint: string | null; takenAt: string; note: string | null }[] = [];
  for (const p of photos ?? []) {
    const path = p.thumbnail_path || p.storage_path;
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    urls.push({
      id: p.id,
      url: signed?.signedUrl ?? "",
      category: p.category,
      checkpoint: p.checkpoint,
      takenAt: p.taken_at,
      note: p.note,
    });
  }

  return NextResponse.json({ photos: urls });
}
