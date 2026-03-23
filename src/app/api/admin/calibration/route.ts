import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

// GET /api/admin/calibration — list pending calibration suggestions
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const admin = createAdminClient();
  const status = req.nextUrl.searchParams.get("status") ?? "pending";

  const { data, error } = await admin
    .from("calibration_suggestions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// PATCH /api/admin/calibration — apply or dismiss a suggestion
export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const body = (await req.json()) as {
    id: string;
    action: "apply" | "dismiss";
    dismissed_reason?: string;
  };

  if (!body.id || !["apply", "dismiss"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: suggestion, error: fetchErr } = await admin
    .from("calibration_suggestions")
    .select("*")
    .eq("id", body.id)
    .single();

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (body.action === "dismiss") {
    await admin
      .from("calibration_suggestions")
      .update({
        status: "dismissed",
        dismissed_reason: body.dismissed_reason ?? null,
      })
      .eq("id", body.id);

    return NextResponse.json({ ok: true });
  }

  // Apply — update the relevant platform_config key
  const configKey = suggestionTypeToConfigKey(
    suggestion.type as string,
    suggestion.move_size as string
  );

  if (configKey) {
    const suggestedRaw = (suggestion.suggested_value as string).replace(/[^\d.]/g, "");
    const { error: configErr } = await admin
      .from("platform_config")
      .upsert({ key: configKey, value: suggestedRaw }, { onConflict: "key" });

    if (configErr) {
      return NextResponse.json({ error: `Config update failed: ${configErr.message}` }, { status: 500 });
    }
  }

  // Mark suggestion as applied
  await admin
    .from("calibration_suggestions")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_by: user?.id ?? null,
    })
    .eq("id", body.id);

  // Audit log
  await admin.from("audit_log").insert({
    action: "calibration_suggestion_applied",
    table_name: "calibration_suggestions",
    record_id: body.id,
    performed_by: user?.id ?? null,
    metadata: {
      type: suggestion.type,
      move_size: suggestion.move_size,
      from: suggestion.current_value,
      to: suggestion.suggested_value,
      reason: suggestion.reason,
    },
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, config_key: configKey });
}

// ═══════════════════════════════════════════════
// Map suggestion type + move_size to a platform_config key
// ═══════════════════════════════════════════════

function suggestionTypeToConfigKey(type: string, moveSize: string): string | null {
  if (type === "hours_baseline") {
    // minimum_hours_by_size is a JSON object — we handle this differently
    return `calibration_override_hours_${moveSize}`;
  }
  if (type === "truck_threshold") {
    return `calibration_override_truck_${moveSize}`;
  }
  if (type === "crew_recommendation") {
    return `calibration_override_crew_${moveSize}`;
  }
  return null;
}
