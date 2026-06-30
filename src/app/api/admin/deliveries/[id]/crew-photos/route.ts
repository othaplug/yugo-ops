import { NextRequest, NextResponse } from "next/server";
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
  // Admin-uploaded photos (operator decision 2026-06-30): admins can
  // attach photos to a delivery directly without going through the
  // crew app — covers post-hoc documentation, customer-supplied photos
  // forwarded by email, or jobs where crew forgot to capture on-site.
  admin_upload: "Admin uploads",
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
  "admin_upload",
  "other",
];

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

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

/**
 * Admin photo upload (2026-06-30). Lands in the same job_photos table
 * + job-photos bucket the crew app writes to, with checkpoint set to
 * `admin_upload` so it renders under its own group on the detail page
 * (and never gets confused with a real crew capture in audits).
 *
 * Accepts multipart/form-data with a single `file` field. Optional
 * `note` field is persisted alongside.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id, delivery_number").eq("id", slug).single()
    : await admin
        .from("deliveries")
        .select("id, delivery_number")
        .ilike("delivery_number", slug)
        .single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart payload" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type ${file.type || "(unknown)"}. Use JPEG, PNG, WebP, or HEIC.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${Math.round(file.size / 1024 / 1024)} MB). Max 20 MB.` },
      { status: 400 },
    );
  }
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 500) : null;

  // Storage path mirrors the crew-side convention: deliveries/<id>/<filename>.
  // Filename is a timestamp + random suffix so concurrent admin uploads
  // can't collide on the same key.
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const extFromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const extFromMime = file.type.split("/")[1]?.toLowerCase() || "";
  const ext = (extFromName || extFromMime || "jpg").replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const storagePath = `deliveries/${delivery.id}/admin-${ts}-${rand}.${ext}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // job_photos row: keeping checkpoint=admin_upload AND category=admin_upload
  // means existing readers (analytics, the GET above, the PoD PDF if it
  // ever bundles non-PoD photos) can filter cleanly either way without
  // false-positiving crew checkpoints.
  const { data: inserted, error: insertError } = await admin
    .from("job_photos")
    .insert({
      job_id: delivery.id,
      job_type: "delivery",
      storage_path: storagePath,
      thumbnail_path: null,
      category: "admin_upload",
      checkpoint: "admin_upload",
      taken_at: new Date().toISOString(),
      note,
    })
    .select("id")
    .single();

  if (insertError) {
    // Best-effort: clean up the orphaned blob so retries don't accumulate
    // dead files in storage.
    await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: `DB insert failed: ${insertError.message}` }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

  return NextResponse.json({
    ok: true,
    photo: {
      id: inserted!.id,
      url: signed?.signedUrl ?? "",
      checkpoint: "admin_upload",
      takenAt: new Date().toISOString(),
      note,
    },
  });
}
