import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { syncDealStageByDeliveryId } from "@/lib/hubspot/sync-deal-stage";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import {
  ensureAndReconcileMultiStopDeliveryTrackingSession,
  isFinalDropStopRow,
  syncMultiStopDeliveryClientCheckpoint,
} from "@/lib/crew/multi-stop-delivery-tracking";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import {
  recordDeliveryTrackingNotifyDedupe,
  shouldSkipDuplicateDeliveryTrackingNotify,
} from "@/lib/tracking-notify-dedupe";

export const dynamic = "force-dynamic";

/** GET /api/crew/stops?delivery_id=xxx — return stops for a delivery */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deliveryId = req.nextUrl.searchParams.get("delivery_id");
  if (!deliveryId) return NextResponse.json({ error: "delivery_id required" }, { status: 400 });

  const db = createAdminClient();

  // Verify crew owns this delivery
  const { data: delivery } = await db
    .from("deliveries")
    .select("id, crew_id, booking_type, stops_completed, customer_name, client_name, delivery_number")
    .eq("id", deliveryId)
    .single();

  if (!delivery || delivery.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: stops } = await db
    .from("delivery_stops")
    .select("id, stop_number, address, customer_name, customer_phone, client_phone, items_description, special_instructions, notes, status, stop_status, stop_type, arrived_at, completed_at, lat, lng")
    .eq("delivery_id", deliveryId)
    .order("stop_number");

  // If stops don't have stop_status yet, use 'status' field as fallback
  const normalizedStops = (stops || []).map((s) => ({
    ...s,
    stop_status: s.stop_status || s.status || "pending",
    stop_type: s.stop_type || "delivery",
  }));

  return NextResponse.json({
    delivery: {
      id: delivery.id,
      bookingType: delivery.booking_type,
      stopsCompleted: delivery.stops_completed || 0,
      totalStops: (stops || []).length,
      clientName: delivery.customer_name || delivery.client_name || "-",
      deliveryNumber: delivery.delivery_number,
    },
    stops: normalizedStops,
  });
}

/** PATCH /api/crew/stops — advance a stop status */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { stop_id, new_status, delivery_id } = body as {
    stop_id: string;
    new_status: string;
    delivery_id: string;
  };

  if (!stop_id || !new_status || !delivery_id) {
    return NextResponse.json({ error: "stop_id, new_status, delivery_id required" }, { status: 400 });
  }

  const VALID_STATUSES = ["pending", "current", "arrived", "in_progress", "completed", "skipped"];
  if (!VALID_STATUSES.includes(new_status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify crew owns this delivery
  const { data: delivery } = await db
    .from("deliveries")
    .select("id, crew_id, stops_completed, is_multi_stop")
    .eq("id", delivery_id)
    .single();

  if (!delivery || delivery.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: stopRow } = await db
    .from("delivery_stops")
    .select("id, delivery_id, stop_status, stop_type, is_final_destination")
    .eq("id", stop_id)
    .maybeSingle();

  if (!stopRow || stopRow.delivery_id !== delivery_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    stop_status: new_status,
    status: new_status,
  };
  let promotedFinalLeg = false;

  if (new_status === "arrived") updates.arrived_at = now;
  if (new_status === "completed") {
    updates.completed_at = now;
    // Increment stops_completed on delivery
    const completedCount = (delivery.stops_completed || 0) + 1;
    await db.from("deliveries").update({ stops_completed: completedCount }).eq("id", delivery_id);

    // Auto-advance next pending stop to 'current'
    const { data: nextStop } = await db
      .from("delivery_stops")
      .select("id")
      .eq("delivery_id", delivery_id)
      .in("stop_status", ["pending"])
      .order("stop_number")
      .limit(1)
      .maybeSingle();

    if (nextStop) {
      await db.from("delivery_stops").update({ stop_status: "current", status: "current" }).eq("id", nextStop.id);
      const { data: promotedMeta } = await db
        .from("delivery_stops")
        .select("is_final_destination, stop_type")
        .eq("id", nextStop.id)
        .maybeSingle();
      promotedFinalLeg = promotedMeta ? isFinalDropStopRow(promotedMeta) : false;
    } else {
      // Last stop completing: row is still in_progress in DB until update below — treat this id as done
      const { data: allStops } = await db
        .from("delivery_stops")
        .select("id, stop_status")
        .eq("delivery_id", delivery_id);
      const allDone = (allStops || []).every(
        (s) =>
          s.id === stop_id || s.stop_status === "completed" || s.stop_status === "skipped",
      );
      if (allDone) {
        await db
          .from("deliveries")
          .update({ status: "completed", completed_at: now, stage: "completed" })
          .eq("id", delivery_id);
        syncDealStageByDeliveryId(delivery_id, "completed").catch(() => {});
        notifyJobCompletedForCrewProfiles(db, { jobType: "delivery", jobId: delivery_id }).catch((e) =>
          console.error("[crew-profile] stops completion:", e),
        );

        const { data: dN } = await db
          .from("deliveries")
          .select("customer_name, client_name, pickup_address, delivery_address, delivery_number")
          .eq("id", delivery_id)
          .maybeSingle();
        const { data: crewN } = await db.from("crews").select("name").eq("id", delivery.crew_id).maybeSingle();
        const teamName = crewN?.name || "Crew";
        const jobName =
          `${dN?.customer_name || ""}${dN?.client_name ? ` (${dN.client_name})` : ""}`.trim() ||
          dN?.delivery_number ||
          delivery_id;
        const skipComp = await shouldSkipDuplicateDeliveryTrackingNotify(db, delivery_id, "completed");
        if (!skipComp) {
          try {
            await notifyOnCheckpoint(
              "completed",
              delivery_id,
              "delivery",
              teamName,
              jobName,
              dN?.pickup_address || undefined,
              dN?.delivery_address || undefined,
            );
            await recordDeliveryTrackingNotifyDedupe(db, delivery_id, "completed");
          } catch (e) {
            console.error("[crew/stops] completion notify:", e);
          }
        }
      }
    }
  }
  if (new_status === "current") {
    // Mark all previously 'current' stops back to pending (only one should be current)
    await db
      .from("delivery_stops")
      .update({ stop_status: "pending", status: "pending" })
      .eq("delivery_id", delivery_id)
      .eq("stop_status", "current")
      .neq("id", stop_id);
  }

  const { error } = await db.from("delivery_stops").update(updates).eq("id", stop_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (new_status === "completed") {
    const stType = String(stopRow.stop_type || "").toLowerCase();
    const isPickupLeg = stType === "pickup";
    const lineStatus = isPickupLeg ? "picked_up" : "delivered";
    await db.from("delivery_stop_items").update({ status: lineStatus }).eq("stop_id", stop_id);

    if (isFinalDropStopRow(stopRow)) {
      const { data: pickupStops } = await db
        .from("delivery_stops")
        .select("id")
        .eq("delivery_id", delivery_id)
        .eq("stop_type", "pickup");
      for (const ps of pickupStops || []) {
        await db.from("delivery_stop_items").update({ status: "delivered" }).eq("stop_id", ps.id);
      }
    }
  }

  if (promotedFinalLeg) {
    try {
      await syncMultiStopDeliveryClientCheckpoint(db, {
        deliveryId: delivery_id,
        checkpointStatus: "en_route_to_destination",
      });
    } catch (e) {
      console.error("[crew/stops] multi-stop en route notify:", e);
    }
  }
  if (new_status === "current" && isFinalDropStopRow(stopRow)) {
    try {
      await syncMultiStopDeliveryClientCheckpoint(db, {
        deliveryId: delivery_id,
        checkpointStatus: "en_route_to_destination",
      });
    } catch (e) {
      console.error("[crew/stops] multi-stop en route notify:", e);
    }
  }
  if (new_status === "arrived" && isFinalDropStopRow(stopRow)) {
    try {
      await syncMultiStopDeliveryClientCheckpoint(db, {
        deliveryId: delivery_id,
        checkpointStatus: "arrived_at_destination",
      });
    } catch (e) {
      console.error("[crew/stops] multi-stop arrived notify:", e);
    }
  }

  if (delivery.is_multi_stop) {
    try {
      await ensureAndReconcileMultiStopDeliveryTrackingSession(db, {
        deliveryId: delivery_id,
        teamId: payload.teamId,
        crewLeadId: payload.crewMemberId ?? null,
      });
    } catch (e) {
      console.error("[crew/stops] multi-stop session reconcile:", e);
    }
  }

  return NextResponse.json({ success: true });
}
