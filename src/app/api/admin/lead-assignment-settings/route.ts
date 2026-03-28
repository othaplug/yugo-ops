import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import type { LeadAssignmentMode } from "@/lib/leads/assignment-mode";

const VALID: LeadAssignmentMode[] = ["round_robin", "smart", "manual"];

export async function GET() {
  const { error: authError } = await requireOwner();
  if (authError) return authError;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_config").select("value").eq("key", "lead_assignment_mode").maybeSingle();
    const mode = String(data?.value || "smart").trim().toLowerCase();
    const normalized = VALID.includes(mode as LeadAssignmentMode) ? mode : "smart";
    return NextResponse.json({ mode: normalized });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;
  try {
    const body = await req.json();
    const raw = String(body?.mode ?? "").trim().toLowerCase();
    if (!VALID.includes(raw as LeadAssignmentMode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin.from("platform_config").upsert(
      { key: "lead_assignment_mode", value: raw, description: "Lead auto-assignment: round_robin | smart | manual" },
      { onConflict: "key" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, mode: raw });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
