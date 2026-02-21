import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

function generateDeviceId(): string {
  return "ipad-" + randomBytes(16).toString("hex");
}

/** POST: Redeem setup code and register device. No auth - code is the auth. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = (body.code || "").toString().trim().toUpperCase();
    const deviceId = (body.deviceId || "").toString().trim() || generateDeviceId();
    const deviceName = (body.deviceName || "iPad").toString().trim();

    if (!code || code.length < 4) {
      return NextResponse.json({ error: "Valid setup code required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: setupCode, error: codeErr } = await admin
      .from("device_setup_codes")
      .select("id, truck_id, default_team_id, expires_at, used_at")
      .eq("code", code)
      .maybeSingle();

    if (codeErr || !setupCode) {
      return NextResponse.json({ error: "Invalid or expired setup code" }, { status: 400 });
    }
    if (setupCode.used_at) {
      return NextResponse.json({ error: "This code has already been used" }, { status: 400 });
    }
    const expiresAt = new Date(setupCode.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: "Setup code has expired" }, { status: 400 });
    }

    const { data: device, error: devErr } = await admin
      .from("registered_devices")
      .upsert(
        {
          device_id: deviceId,
          device_name: deviceName,
          truck_id: setupCode.truck_id,
          default_team_id: setupCode.default_team_id,
          last_active_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "device_id" }
      )
      .select("id, device_id, device_name, truck_id, default_team_id")
      .single();

    if (devErr) {
      console.error("[register-device] upsert error:", devErr);
      return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
    }

    await admin
      .from("device_setup_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", setupCode.id);

    return NextResponse.json({
      ok: true,
      deviceId: device?.device_id,
      deviceName: device?.device_name,
      truckId: device?.truck_id,
      teamId: device?.default_team_id,
    });
  } catch (e) {
    console.error("[register-device] error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
