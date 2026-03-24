import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

function parseDevice(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Mac / Chrome";
    if (/Safari/i.test(ua)) return "Mac / Safari";
    if (/Firefox/i.test(ua)) return "Mac / Firefox";
    return "Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Windows / Chrome";
    if (/Firefox/i.test(ua)) return "Windows / Firefox";
    if (/Edge/i.test(ua)) return "Windows / Edge";
    return "Windows";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "—"
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ role: null });
    }

    const email = (user.email || "").trim().toLowerCase();
    const admin = createAdminClient();

    // platform_users: role = access (client → client portal; admin/manager/dispatcher → admin)
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (platformUser) {
      const role = platformUser.role || "";
      // Record login event fire-and-forget — never block the response
      void Promise.resolve(admin.from("login_history").insert({
        user_id: user.id,
        device: parseDevice(req.headers.get("user-agent")),
        ip_address: getClientIp(req),
        status: "success",
      })).catch(() => {});

      if (role === "client") return NextResponse.json({ role: "client" });
      if (["admin", "manager", "dispatcher", "coordinator", "viewer", "sales"].includes(role)) {
        return NextResponse.json({ role: "admin" });
      }
    }

    // No staff role — check if partner
    const { data: partnerRows } = await admin
      .from("partner_users")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    if (partnerRows && partnerRows.length > 0) return NextResponse.json({ role: "partner" });

    // Last resort — check if move client by email
    const { data: move } = await supabase
      .from("moves")
      .select("id")
      .ilike("client_email", email)
      .limit(1)
      .maybeSingle();
    if (move) return NextResponse.json({ role: "client" });

    return NextResponse.json({ role: null });
  } catch {
    // Never let an unexpected error surface as 404 — degrade gracefully
    return NextResponse.json({ role: null });
  }
}
