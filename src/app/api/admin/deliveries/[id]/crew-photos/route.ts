import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { isUuid } from "@/lib/move-code";

const BUCKET = "job-photos";
const CHECKPOINT_LABELS: Record<string, string> = {
  arrived_at_pickup: "Arrived at Pickup",
  loading: "Loading",
  en_route_to_destination: "En Route",
  arrived_at_destination: "Arrived at Destination",
  unloading: "Unloading",
  completed: "Completed",
  arrived: "Arrived",
  other: "Other photos",
  pre_move_condition: "Pre-move condition",
  in_transit: "In transit",
  delivery_placement: "Delivery placement",
  post_move_condition: "Post-move condition",
  damage_documentation: "Damage documentation",
};

const CHECKPOINT_ORDER = [
  "arrived_at_pickup",
  "arrived",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
  "pre_move_condition",
  "in_transit",
  "delivery_placement",
  "post_move_condition",
  "damage_documentation",
  "other",
];

/** Admin: crew photos for a delivery (from job_photos). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id").eq("id", slug).single()
    : await admin.from("deliveries").select("id").ilike("delivery_number", slug).single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  const { data: photos, error } = await admin
    .from("job_photos")
    .select("id, storage_path, thumbnail_path, category, checkpoint, taken_at, note")
    .eq("job_id", delivery.id)
    .eq("job_type", "delivery")
    .order("taken_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCheckpoint: Record<string, { id: string; url: string; takenAt: string; note: string | null }[]> = {};
  for (const p of photos ?? []) {
    const path = p.thumbnail_path || p.storage_path;
    if (!path) continue;
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    const cp = (p.checkpoint || p.category || "other").toString().toLowerCase();
    if (!byCheckpoint[cp]) byCheckpoint[cp] = [];
    byCheckpoint[cp].push({
      id: p.id,
      url: signed?.signedUrl ?? "",
      takenAt: p.taken_at,
      note: p.note,
    });
  }

  const orderedSet = new Set<string>(CHECKPOINT_ORDER);
  const ordered = [
    ...CHECKPOINT_ORDER.filter((c) => byCheckpoint[c]?.length),
    ...Object.keys(byCheckpoint).filter((k) => !orderedSet.has(k)),
  ].map((c) => ({
    checkpoint: c,
    label: CHECKPOINT_LABELS[c] || c.replace(/_/g, " "),
    photos: byCheckpoint[c],
  }));

  return NextResponse.json({ byCheckpoint: ordered });
}
