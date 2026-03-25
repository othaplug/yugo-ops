import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { resolveCrewInventoryJob } from "@/lib/resolve-crew-inventory-job";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId: rawJobId } = await params;
  const stage = req.nextUrl.searchParams.get("stage") || "unloading";

  const admin = createAdminClient();
  const ctx = await resolveCrewInventoryJob(admin, rawJobId);
  if (!ctx || ctx.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const entityId = ctx.id;
  const returnBothStages = stage === "all" || stage === "both";

  if (returnBothStages) {
    const { data: verifications } = await admin
      .from("inventory_verifications")
      .select("move_inventory_id, room, item_name, stage")
      .eq("job_id", entityId)
      .in("stage", ["loading", "unloading"]);

    const loading = (verifications || []).filter((v) => v.stage === "loading");
    const unloading = (verifications || []).filter((v) => v.stage === "unloading");

    const toIds = (list: typeof verifications) =>
      new Set((list || []).filter((v) => v.move_inventory_id).map((v) => v.move_inventory_id!));
    /** Room-only confirmations (item_name matches room, e.g. residential room checklist). */
    const toRooms = (list: typeof verifications) =>
      new Set(
        (list || [])
          .filter(
            (v) =>
              v.room &&
              !v.move_inventory_id &&
              (!v.item_name || String(v.item_name).trim() === String(v.room).trim())
          )
          .map((v) => v.room!)
      );
    /** Line items verified by room + name (delivery list, move rows without UUID in UI). */
    const toKeys = (list: typeof verifications) =>
      new Set(
        (list || [])
          .filter(
            (v) =>
              v.room &&
              v.item_name &&
              String(v.item_name).trim() !== String(v.room).trim()
          )
          .map((v) => `${v.room}::${v.item_name}`)
      );

    return NextResponse.json({
      verifiedIdsLoading: Array.from(toIds(loading)),
      verifiedIdsUnloading: Array.from(toIds(unloading)),
      verifiedRoomsLoading: Array.from(toRooms(loading)),
      verifiedRoomsUnloading: Array.from(toRooms(unloading)),
      verifiedKeysLoading: Array.from(toKeys(loading)),
      verifiedKeysUnloading: Array.from(toKeys(unloading)),
    });
  }

  const { data: verifications } = await admin
    .from("inventory_verifications")
    .select("move_inventory_id, room, item_name, stage")
    .eq("job_id", entityId)
    .eq("stage", stage);

  const verifiedIds = new Set(
    (verifications || []).filter((v) => v.move_inventory_id).map((v) => v.move_inventory_id)
  );
  const verifiedKeys = new Set(
    (verifications || [])
      .filter(
        (v) =>
          v.room &&
          v.item_name &&
          String(v.item_name).trim() !== String(v.room).trim()
      )
      .map((v) => `${v.room}::${v.item_name}`)
  );
  const verifiedRooms = new Set(
    (verifications || [])
      .filter(
        (v) =>
          v.room &&
          !v.move_inventory_id &&
          (!v.item_name || String(v.item_name).trim() === String(v.room).trim())
      )
      .map((v) => v.room!)
  );

  return NextResponse.json({
    verifiedIds: Array.from(verifiedIds),
    verifiedKeys: Array.from(verifiedKeys),
    verifiedRooms: Array.from(verifiedRooms),
  });
}
