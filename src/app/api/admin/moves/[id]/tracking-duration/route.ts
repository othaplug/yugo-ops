import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";

/** GET: Current or last tracking session duration for this move (admin). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const db = createAdminClient();
  const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = isSuperAdminEmail(user.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  const { data: session } = await db
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
