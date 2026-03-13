import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

/** GET /api/admin/audit-log — Fetch audit entries (admin/owner only). Uses admin client to bypass RLS. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireRole("admin");
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);
  const action = searchParams.get("action") || "";
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  const admin = createAdminClient();
  let query = admin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) {
    query = query.eq("action", action);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[audit-log] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let logs = data ?? [];
  if (search) {
    logs = logs.filter((log) => {
      const email = (log.user_email || "").toLowerCase();
      const resource = (log.resource_id || "").toLowerCase();
      return email.includes(search) || resource.includes(search);
    });
  }

  return NextResponse.json({ logs });
}
