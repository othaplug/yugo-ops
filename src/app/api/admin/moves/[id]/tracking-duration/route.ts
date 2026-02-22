import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperAdminEmail } from "@/lib/super-admin";

/** GET: Current or last tracking session duration for this move (admin). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail() || platformUser?.role === "admin" || platformUser?.role === "manager";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("tracking_sessions")
    .select("started_at, completed_at, is_active")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return NextResponse.json({ startedAt: null, completedAt: null, isActive: false });

  return NextResponse.json({
    startedAt: session.started_at,
    completedAt: session.completed_at ?? null,
    isActive: !!session.is_active,
  });
}
