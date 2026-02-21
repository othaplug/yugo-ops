import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET: Returns crew lead + team members for device-based login. Query: ?deviceId=xxx */
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("deviceId");
    if (!deviceId) {
      return NextResponse.json({ hasDevice: false });
    }

    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: device, error: devErr } = await admin
      .from("registered_devices")
      .select("id, truck_id, default_team_id, device_name")
      .eq("device_id", deviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (devErr || !device) {
      return NextResponse.json({ hasDevice: false });
    }

    let teamId = device.default_team_id;

    if (device.truck_id) {
      const { data: assignment } = await admin
        .from("truck_assignments")
        .select("team_id")
        .eq("truck_id", device.truck_id)
        .eq("date", today)
        .maybeSingle();
      if (assignment?.team_id) teamId = assignment.team_id;
    }

    if (!teamId) {
      return NextResponse.json({
        hasDevice: true,
        deviceName: device.device_name,
        truckId: device.truck_id,
        noTeamAssigned: true,
      });
    }

    const { data: members, error: memErr } = await admin
      .from("crew_members")
      .select("id, name, role, avatar_initials, pin_length")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("role", { ascending: false });

    if (memErr || !members?.length) {
      return NextResponse.json({
        hasDevice: true,
        deviceName: device.device_name,
        teamId,
        noMembers: true,
      });
    }

    const crewLead = members.find((m) => m.role === "lead") || members[0];
    const [{ data: truckRow }, { data: teamRow }] = await Promise.all([
      device.truck_id
        ? admin.from("trucks").select("name").eq("id", device.truck_id).maybeSingle()
        : { data: null },
      admin.from("crews").select("name").eq("id", teamId).maybeSingle(),
    ]);
    const truckName = truckRow?.name || "Truck";
    const teamName = teamRow?.name || "Team";

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date();
    const dateStr = dayNames[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();

    return NextResponse.json({
      hasDevice: true,
      crewLead: {
        id: crewLead.id,
        name: crewLead.name,
        initials: crewLead.avatar_initials || crewLead.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        role: crewLead.role,
        pinLength: crewLead.pin_length ?? 4,
      },
      teamMembers: members.map((m) => ({
        id: m.id,
        name: m.name,
        initials: m.avatar_initials || m.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        role: m.role,
        pinLength: m.pin_length ?? 4,
      })),
      truckName,
      teamName,
      dateStr,
      teamId,
    });
  } catch (e) {
    console.error("[login-context] error:", e);
    return NextResponse.json({ hasDevice: false });
  }
}
