import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedCrewFromRequest } from "@/lib/crew-token";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import {
  WAIVER_CATEGORIES,
  type WaiverCategoryCode,
} from "@/lib/waivers/waiver-categories";

const ALLOWED_CODES = new Set(WAIVER_CATEGORIES.map((c) => c.code));

function labelForCategory(code: string): string {
  const found = WAIVER_CATEGORIES.find((c) => c.code === code);
  return found?.label ?? code.replace(/_/g, " ");
}

/** POST: Save on-site risk waiver after client signs or declines (crew session). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = getVerifiedCrewFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    category,
    item_name: itemName,
    description,
    photo_paths: photoPathsRaw,
    crew_recommendation: crewRecommendation,
    status,
    signature_data: signatureData,
    signed_by: signedBy,
    reported_by: reportedBy,
    reported_by_name: reportedByName,
  } = body as {
    category?: string;
    item_name?: string;
    description?: string;
    photo_paths?: string[];
    crew_recommendation?: string | null;
    status?: string;
    signature_data?: string;
    signed_by?: string;
    reported_by?: string;
    reported_by_name?: string;
  };

  if (!category || !ALLOWED_CODES.has(category as WaiverCategoryCode)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!itemName || typeof itemName !== "string" || !itemName.trim()) {
    return NextResponse.json({ error: "item_name required" }, { status: 400 });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }
  if (status !== "signed" && status !== "declined") {
    return NextResponse.json({ error: "status must be signed or declined" }, { status: 400 });
  }

  const photoPaths = Array.isArray(photoPathsRaw)
    ? photoPathsRaw.filter((p) => typeof p === "string" && p.trim()).slice(0, 12)
    : [];
  if (photoPaths.length === 0) {
    return NextResponse.json(
      { error: "At least one photo is required" },
      { status: 400 },
    );
  }

  let rec: string | null = null;
  if (
    crewRecommendation === "proceed_with_caution" ||
    crewRecommendation === "do_not_recommend"
  ) {
    rec = crewRecommendation;
  } else if (crewRecommendation != null && crewRecommendation !== "") {
    return NextResponse.json({ error: "Invalid crew_recommendation" }, { status: 400 });
  }

  if (status === "signed") {
    if (!signatureData || typeof signatureData !== "string" || !signatureData.startsWith("data:image")) {
      return NextResponse.json({ error: "signature required" }, { status: 400 });
    }
    if (!signedBy || typeof signedBy !== "string" || !signedBy.trim()) {
      return NextResponse.json({ error: "signed_by required" }, { status: 400 });
    }
  }

  const { id: moveId } = await params;
  const slug = moveId?.trim() || "";
  const admin = createAdminClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slug,
    );
  const { data: move } = isUuid
    ? await admin.from("moves").select("id, crew_id, client_name").eq("id", slug).single()
    : await admin
        .from("moves")
        .select("id, crew_id, client_name")
        .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
        .single();
  if (!move || move.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const reportedByUuid =
    typeof reportedBy === "string" && /^[0-9a-f-]{36}$/i.test(reportedBy)
      ? reportedBy
      : payload.crewMemberId;
  const reporterName =
    typeof reportedByName === "string" && reportedByName.trim()
      ? reportedByName.trim()
      : payload.name;

  const nowIso = new Date().toISOString();
  const insertRow = {
    move_id: move.id,
    category,
    item_name: itemName.trim(),
    description: description.trim(),
    photo_urls: photoPaths,
    crew_recommendation: rec,
    reported_by: reportedByUuid,
    reported_by_name: reporterName,
    status,
    signature_data: status === "signed" ? signatureData : null,
    signed_by: status === "signed" ? signedBy!.trim() : null,
    signed_at: nowIso,
  };

  const { data: row, error } = await admin
    .from("move_waivers")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    console.error("[move waivers insert]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const catLabel = labelForCategory(category);
  const clientLabel = (move.client_name as string | null)?.trim() || "Client";

  if (status === "signed") {
    await notifyAdmins("move_waiver_signed", {
      moveId: move.id,
      sourceId: move.id,
      subject: `Waiver signed: ${catLabel}`,
      description: `${clientLabel}: ${itemName.trim()}. Signed on site.`,
    }).catch(() => {});
  } else {
    await notifyAdmins("move_waiver_declined", {
      moveId: move.id,
      sourceId: move.id,
      subject: `Waiver declined: ${catLabel}`,
      description: `${clientLabel} declined to proceed with ${itemName.trim()}.`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: row.id });
}
