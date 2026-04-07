import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getLocalDateString, getAppTimezone, addCalendarDaysYmd } from "@/lib/business-timezone";
import { getMoveDetailPath, getDeliveryDetailPath, getMoveCode } from "@/lib/move-code";
import { deliveryContactEmail, deliveryContactPhone } from "@/lib/calendar/delivery-contact";

export const dynamic = "force-dynamic";

/** GET today's dispatch data: jobs, crews, events, stats, alerts */
export async function GET(req: NextRequest) {
  try {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const params = req.nextUrl.searchParams;
  const dateParam = params.get("date");
  const tz = getAppTimezone();
  // Use date param directly when valid YYYY-MM-DD (avoids UTC parsing shifting to wrong day)
  const targetDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : getLocalDateString(new Date(), tz);

  const admin = createAdminClient();

  const nextDateStr = addCalendarDaysYmd(targetDate, 1, tz);

  const results = await Promise.allSettled([
    admin
      .from("moves")
      .select(
        "id, move_code, crew_id, client_name, client_phone, client_email, tier_selected, from_address, to_address, from_lat, from_lng, to_lat, to_lng, scheduled_date, preferred_time, arrival_window, status, stage, eta_current_minutes, updated_at"
      )
      .eq("scheduled_date", targetDate)
      .neq("status", "cancelled")
      .order("preferred_time", { ascending: true, nullsFirst: false }),
    // All scheduled deliveries (B2B one-off, partner, retail, day rate) share this query — no service-type filter.
    admin
      .from("deliveries")
      .select(
        "id, delivery_number, crew_id, client_name, customer_name, customer_phone, customer_email, contact_phone, contact_email, end_customer_phone, end_customer_email, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, scheduled_date, time_slot, status, stage, eta_current_minutes, updated_at"
      )
      .eq("scheduled_date", targetDate)
      .not("status", "in", '("cancelled")')
      .order("time_slot", { ascending: true, nullsFirst: false }),
    admin.from("crews").select("id, name, members, current_lat, current_lng, status, updated_at").order("name"),
    admin.from("crew_members").select("id, name, team_id").eq("is_active", true),
    admin
      .from("tracking_sessions")
      .select("id, team_id, job_id, job_type, status, last_location, updated_at")
      .eq("is_active", true),
    admin
      .from("crew_locations")
      .select("crew_id, lat, lng, status, updated_at, current_move_id, current_client_name, current_from_address, current_to_address"),
    admin
      .from("eta_sms_log")
      .select("id, move_id, delivery_id, message_type, message_body, sent_at, eta_minutes, recipient_name")
      .gte("sent_at", `${targetDate}T00:00:00`)
      .lt("sent_at", `${targetDate}T23:59:59.999Z`)
      .order("sent_at", { ascending: false })
      .limit(100),
    admin
      .from("tips")
      .select("id, move_id, client_name, amount, charged_at")
      .gte("charged_at", `${targetDate}T00:00:00`)
      .lt("charged_at", `${targetDate}T23:59:59.999Z`)
      .order("charged_at", { ascending: false })
      .limit(50),
    admin
      .from("proof_of_delivery")
      .select("id, move_id, delivery_id, satisfaction_rating, completed_at")
      .gte("completed_at", `${targetDate}T00:00:00`)
      .lt("completed_at", `${targetDate}T23:59:59.999Z`)
      .order("completed_at", { ascending: false })
      .limit(50),
    admin
      .from("review_requests")
      .select("id, move_id, client_rating, client_feedback, review_clicked_at")
      .not("client_rating", "is", null)
      .gte("review_clicked_at", `${targetDate}T00:00:00`)
      .lt("review_clicked_at", `${targetDate}T23:59:59.999Z`)
      .order("review_clicked_at", { ascending: false })
      .limit(50),
    admin
      .from("status_events")
      .select("id, entity_type, entity_id, event_type, description, icon, created_at")
      .gte("created_at", `${targetDate}T00:00:00`)
      .lt("created_at", `${nextDateStr}T00:00:00`)
      .in("entity_type", ["move", "delivery"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const unwrap = <T>(r: PromiseSettledResult<{ data: T | null; error?: unknown }>, label: string): T | null => {
    if (r.status === "rejected") {
      console.error(`[dispatch/today] ${label} failed:`, r.reason);
      return null;
    }
    const v = r.value;
    if (v?.error) console.error(`[dispatch/today] ${label} error:`, v.error);
    return (v?.data ?? null) as T | null;
  };
  const moves = unwrap(results[0], "moves");
  const deliveries = unwrap(results[1], "deliveries");
  const crews = unwrap(results[2], "crews");
  const crewMembers = unwrap(results[3], "crew_members");
  const sessions = unwrap(results[4], "tracking_sessions");
  const crewLocations = unwrap(results[5], "crew_locations");
  const etaLogs = unwrap(results[6], "eta_sms_log");
  const tipsToday = unwrap(results[7], "tips");
  const podsToday = unwrap(results[8], "proof_of_delivery");
  const reviewsToday = unwrap(results[9], "review_requests");
  const statusEventsToday = unwrap(results[10], "status_events");

  const membersByTeam = new Map<string, string[]>();
  for (const m of crewMembers || []) {
    const list = membersByTeam.get(m.team_id) || [];
    list.push(m.name);
    membersByTeam.set(m.team_id, list);
  }

  const sessionByTeam = new Map<string, NonNullable<typeof sessions>[number]>();
  for (const s of sessions || []) {
    const existing = sessionByTeam.get(s.team_id);
    if (!existing || (s.updated_at || "") > (existing.updated_at || "")) {
      sessionByTeam.set(s.team_id, s);
    }
  }

  const locationByCrew = new Map<string, NonNullable<typeof crewLocations>[number]>();
  for (const loc of crewLocations || []) {
    if (loc.crew_id) locationByCrew.set(loc.crew_id, loc);
  }

  const moveMap = new Map((moves || []).map((m) => [m.id, m]));
  const deliveryMap = new Map((deliveries || []).map((d) => [d.id, d]));
  const moveByCode = new Map((moves || []).map((m) => [m.move_code || m.id, m]));
  const deliveryByNumber = new Map((deliveries || []).map((d) => [d.delivery_number || d.id, d]));
  const crewMap = new Map((crews || []).map((c) => [c.id, c]));

  const jobs: Array<{
    id: string;
    type: "move" | "delivery";
    label: string;
    client: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    tier?: string;
    partnerName?: string;
    fromAddress: string;
    toAddress: string;
    scheduledTime: string | null;
    status: string;
    stage: string | null;
    crewId: string | null;
    crewName: string | null;
    crewSize: number;
    truckSize?: string;
    etaMinutes: number | null;
    fromLat: number | null;
    fromLng: number | null;
    toLat: number | null;
    toLng: number | null;
    href: string;
    progress: number;
    currentStageLabel: string;
    updatedAt: string | null;
  }> = [];

  const ACTIVE_STATUSES = ["en_route", "en_route_to_pickup", "arrived_at_pickup", "loading", "en_route_to_destination", "arrived_at_destination", "unloading", "in_progress", "dispatched", "in_transit"];
  const COMPLETED_STATUSES = ["completed", "delivered", "job_complete"];

  function progressFromStage(status: string, stage: string | null): number {
    const s = (stage || status || "").toLowerCase().replace(/-/g, "_");
    const map: Record<string, number> = {
      confirmed: 0,
      scheduled: 0,
      en_route: 20,
      en_route_to_pickup: 20,
      arrived_at_pickup: 30,
      loading: 40,
      en_route_to_destination: 60,
      in_transit: 60,
      arrived_at_destination: 80,
      unloading: 80,
      completed: 100,
      delivered: 100,
      job_complete: 100,
    };
    return map[s] ?? 0;
  }

  function stageLabel(status: string, stage: string | null, type: "move" | "delivery"): string {
    const s = (stage || status || "").toLowerCase().replace(/-/g, "_");
    const labels: Record<string, string> = {
      confirmed: "Confirmed, crew notified",
      scheduled: "Scheduled",
      en_route: "Crew departed",
      en_route_to_pickup: "En route to pickup",
      arrived_at_pickup: "Loading at pickup",
      loading: "Loading at pickup",
      en_route_to_destination: "In transit to destination",
      in_transit: "In transit to destination",
      arrived_at_destination: "Unloading at destination",
      unloading: "Unloading at destination",
      completed: "Completed",
      delivered: "Completed",
      job_complete: "Completed",
    };
    return labels[s] || status?.replace(/_/g, " ") || "-";
  }

  for (const m of moves || []) {
    const crew = m.crew_id ? crewMap.get(m.crew_id) : null;
    const members = m.crew_id ? membersByTeam.get(m.crew_id) || (crew?.members as string[]) || [] : [];
    jobs.push({
      id: m.id,
      type: "move",
      label: m.move_code || getMoveCode(m),
      client: m.client_name || "-",
      clientPhone: m.client_phone || null,
      clientEmail: m.client_email || null,
      tier: m.tier_selected || undefined,
      fromAddress: m.from_address || "",
      toAddress: m.to_address || "",
      scheduledTime: m.preferred_time || m.arrival_window || null,
      status: m.status || "scheduled",
      stage: m.stage || null,
      crewId: m.crew_id || null,
      crewName: crew?.name || null,
      crewSize: Array.isArray(members) ? members.length : 0,
      etaMinutes: m.eta_current_minutes ?? null,
      fromLat: m.from_lat != null ? Number(m.from_lat) : null,
      fromLng: m.from_lng != null ? Number(m.from_lng) : null,
      toLat: m.to_lat != null ? Number(m.to_lat) : null,
      toLng: m.to_lng != null ? Number(m.to_lng) : null,
      href: getMoveDetailPath(m),
      progress: progressFromStage(m.status || "", m.stage),
      currentStageLabel: stageLabel(m.status || "", m.stage, "move"),
      updatedAt: m.updated_at || null,
    });
  }

  for (const d of deliveries || []) {
    const crew = d.crew_id ? crewMap.get(d.crew_id) : null;
    const members = d.crew_id ? membersByTeam.get(d.crew_id) || (crew?.members as string[]) || [] : [];
    jobs.push({
      id: d.id,
      type: "delivery",
      label: d.delivery_number || "Delivery",
      client: d.client_name || d.customer_name || "-",
      clientPhone: deliveryContactPhone(d),
      clientEmail: deliveryContactEmail(d),
      partnerName: d.client_name || undefined,
      fromAddress: d.pickup_address || "",
      toAddress: d.delivery_address || "",
      scheduledTime: d.time_slot || null,
      status: d.status || "scheduled",
      stage: d.stage || null,
      crewId: d.crew_id || null,
      crewName: crew?.name || null,
      crewSize: Array.isArray(members) ? members.length : 0,
      etaMinutes: d.eta_current_minutes ?? null,
      fromLat: d.pickup_lat != null ? Number(d.pickup_lat) : null,
      fromLng: d.pickup_lng != null ? Number(d.pickup_lng) : null,
      toLat: d.delivery_lat != null ? Number(d.delivery_lat) : null,
      toLng: d.delivery_lng != null ? Number(d.delivery_lng) : null,
      href: getDeliveryDetailPath(d),
      progress: progressFromStage(d.status || "", d.stage),
      currentStageLabel: stageLabel(d.status || "", d.stage, "delivery"),
      updatedAt: d.updated_at || null,
    });
  }

  const crewsOut = (crews || []).map((c) => {
    const session = sessionByTeam.get(c.id);
    const loc = locationByCrew.get(c.id);
    const sessionLoc = session?.last_location as { lat?: number; lng?: number } | null;
    const hasSessionPos = sessionLoc?.lat != null && sessionLoc?.lng != null;
    const hasCrewPos = c.current_lat != null && c.current_lng != null;
    const hasLocPos = loc?.lat != null && loc?.lng != null;
    let lat = hasSessionPos ? sessionLoc!.lat! : hasCrewPos ? c.current_lat! : hasLocPos ? loc!.lat : null;
    let lng = hasSessionPos ? sessionLoc!.lng! : hasCrewPos ? c.current_lng! : hasLocPos ? loc!.lng : null;
    const members = (c.members as string[] | null) || membersByTeam.get(c.id) || [];
    return {
      id: c.id,
      name: c.name || members[0] || "Team",
      members,
      status: loc?.status || session?.status || c.status || "idle",
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      updatedAt: loc?.updated_at || session?.updated_at || c.updated_at,
      currentJobId: session?.job_id || null,
      currentJobType: session?.job_type || null,
      currentClientName: loc?.current_client_name || null,
      currentFromAddress: loc?.current_from_address || null,
      currentToAddress: loc?.current_to_address || null,
    };
  });

  const events: Array<{
    id: string;
    type: string;
    icon: string;
    description: string;
    timestamp: string;
    jobId?: string;
    jobType?: "move" | "delivery";
    href?: string;
    crewId?: string | null;
  }> = [];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  for (const e of etaLogs || []) {
    const job = e.move_id ? moveMap.get(e.move_id) : e.delivery_id ? deliveryMap.get(e.delivery_id) : null;
    const jobLabel = job
      ? ("move_code" in job
          ? (job as { move_code?: string; id?: string }).move_code || getMoveCode(job as { move_code?: string; id?: string })
          : (job as { delivery_number?: string }).delivery_number || "Delivery")
      : "Job";
    const moveForHref = e.move_id ? moveMap.get(e.move_id) : null;
    const deliveryForHref = e.delivery_id ? deliveryMap.get(e.delivery_id) : null;
    const href = moveForHref ? getMoveDetailPath(moveForHref) : deliveryForHref ? getDeliveryDetailPath(deliveryForHref) : undefined;
    const typeLabels: Record<string, string> = {
      crew_departed: "departed for",
      eta_15_min: "ETA 15 min, SMS sent for",
      crew_arrived: "arrived at",
      in_progress: "in progress -",
      completed: "completed -",
    };
    const desc = typeLabels[e.message_type] || e.message_type;
    const crewId = job && "crew_id" in job ? (job as { crew_id?: string }).crew_id : null;
    events.push({
      id: `eta-${e.id}`,
      type: "eta_sms",
      icon: "message",
      description: `${desc} ${jobLabel}, ${e.recipient_name || "Client"}`,
      timestamp: e.sent_at,
      jobId: jobLabel,
      jobType: e.move_id ? "move" : "delivery",
      href,
      crewId: crewId ?? null,
    });
  }

  for (const t of tipsToday || []) {
    const move = t.move_id ? moveMap.get(t.move_id) : null;
    const jobLabel = move?.move_code || (move ? getMoveCode(move) : "Move");
    const crewId = move && "crew_id" in move ? (move as { crew_id?: string }).crew_id : null;
    events.push({
      id: `tip-${t.id}`,
      type: "tip",
      icon: "dollar",
      description: `${t.client_name || "Client"} tipped $${Number(t.amount || 0).toFixed(0)}`,
      timestamp: t.charged_at,
      jobId: jobLabel,
      jobType: "move",
      href: move ? getMoveDetailPath(move) : undefined,
      crewId: crewId ?? null,
    });
  }

  for (const p of podsToday || []) {
    const job = p.move_id ? moveMap.get(p.move_id) : p.delivery_id ? deliveryMap.get(p.delivery_id) : null;
    const jobLabel = job
      ? ("move_code" in job
          ? (job as { move_code?: string; id?: string }).move_code || getMoveCode(job as { move_code?: string; id?: string })
          : (job as { delivery_number?: string }).delivery_number || "Delivery")
      : "Job";
    const crewId = job && "crew_id" in job ? (job as { crew_id?: string }).crew_id : null;
    events.push({
      id: `pod-${p.id}`,
      type: "pod",
      icon: "truck",
      description: `PoD captured for ${jobLabel}`,
      timestamp: p.completed_at || p.id,
      jobId: jobLabel,
      jobType: p.move_id ? "move" : "delivery",
      href: job ? (p.move_id ? getMoveDetailPath(job) : getDeliveryDetailPath(job)) : undefined,
      crewId: crewId ?? null,
    });
  }

  for (const r of reviewsToday || []) {
    const move = r.move_id ? moveMap.get(r.move_id) : null;
    const jobLabel = move?.move_code || (move ? getMoveCode(move) : "Move");
    const crewId = move && "crew_id" in move ? (move as { crew_id?: string }).crew_id : null;
    events.push({
      id: `review-${r.id}`,
      type: "review",
      icon: "star",
      description: `${jobLabel} rated ${r.client_rating}/5`,
      timestamp: r.review_clicked_at || r.id,
      jobId: jobLabel,
      jobType: "move",
      href: move ? getMoveDetailPath(move) : undefined,
      crewId: crewId ?? null,
    });
  }

  for (const se of statusEventsToday || []) {
    const job =
      se.entity_type === "move"
        ? (moveMap.get(se.entity_id) ?? moveByCode.get(se.entity_id))
        : (deliveryMap.get(se.entity_id) ?? deliveryByNumber.get(se.entity_id));
    if (!job) continue;
    const jobLabel = "move_code" in job ? (job as { move_code?: string }).move_code : (job as { delivery_number?: string }).delivery_number;
    const label = jobLabel || se.entity_id.slice(0, 8);
    const crewId = job && "crew_id" in job ? (job as { crew_id?: string }).crew_id : null;
    events.push({
      id: `se-${se.id}`,
      type: se.event_type,
      icon: se.icon === "truck" ? "status_change" : (se.icon || "status_change"),
      description: se.description || `${label}, ${se.event_type}`,
      timestamp: se.created_at,
      jobId: label,
      jobType: se.entity_type as "move" | "delivery",
      href: se.entity_type === "move" ? getMoveDetailPath(job) : getDeliveryDetailPath(job),
      crewId: crewId ?? null,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const eventsOut = events.slice(0, 50);

  const assignedCount = jobs.filter((j) => j.crewId).length;
  const unassignedCount = jobs.filter((j) => !j.crewId).length;
  const activeCrewIds = new Set(
    jobs.filter((j) => j.crewId && ACTIVE_STATUSES.includes((j.status || "").toLowerCase())).map((j) => j.crewId!)
  );
  const completedCount = jobs.filter((j) => COMPLETED_STATUSES.includes((j.status || "").toLowerCase())).length;

  const stats = {
    jobsToday: jobs.length,
    assigned: assignedCount,
    unassigned: unassignedCount,
    activeCrews: activeCrewIds.size,
    completed: completedCount,
  };

  const alerts: Array<{
    id: string;
    type: "unassigned" | "gps_offline" | "overdue" | "problem";
    message: string;
    action: string;
    href?: string;
  }> = [];

  for (const j of jobs) {
    if (!j.crewId && j.scheduledTime) {
      alerts.push({
        id: `unassigned-${j.id}`,
        type: "unassigned",
        message: `${j.label} at ${j.scheduledTime} has no crew assigned`,
        action: "Assign",
        href: j.href,
      });
    }
  }

  const GPS_STALE_MS = 10 * 60 * 1000;
  for (const c of crewsOut) {
    if (c.lat != null && c.lng != null && c.status && !["idle", "offline"].includes(c.status)) {
      const updated = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      if (Date.now() - updated > GPS_STALE_MS) {
        alerts.push({
          id: `gps-${c.id}`,
          type: "gps_offline",
          message: `${c.name} GPS offline for 10+ minutes`,
          action: "Check",
          href: "/admin/crew",
        });
      }
    }
  }

  return NextResponse.json(
    {
      date: targetDate,
      jobs,
      crews: crewsOut,
      events: eventsOut,
      stats,
      alerts,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
  } catch (err) {
    console.error("[dispatch/today]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dispatch data" },
      { status: 500 }
    );
  }
}
