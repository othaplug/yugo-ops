import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLocalDateDisplay } from "@/lib/business-timezone";
import { resolveRegisteredDeviceTeamId } from "@/lib/crew-device-team";

/** GET: Returns crew lead + team members for device-based login. Query: ?deviceId=xxx. Rate limited per deviceId. */
export async function GET(req: NextRequest) {
  try {
    const deviceId = (req.nextUrl.searchParams.get("deviceId") || "").trim().slice(0, 128);
    if (!deviceId) {
      return NextResponse.json({ hasDevice: false });
    }

    const key = `login-context:${deviceId}`;
    if (!checkRateLimit(key, 60_000, 30)) {
      return NextResponse.json({ hasDevice: false }, { status: 429 });
    }

    const resolved = await resolveRegisteredDeviceTeamId(deviceId);
    if (!resolved) {
      return NextResponse.json({ hasDevice: false });
    }

    const { device, teamId } = resolved;
    const admin = createAdminClient();

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

    const dateStr = getLocalDateDisplay(new Date());

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
