import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ role: null });
  }

  const email = (user.email || "").trim().toLowerCase();

  // platform_users: role = access (client → client portal; admin/manager/dispatcher → admin)
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (platformUser) {
    if (platformUser.role === "client") return NextResponse.json({ role: "client" });
    if (["admin", "manager", "dispatcher", "coordinator", "viewer"].includes(platformUser.role || "")) return NextResponse.json({ role: "admin" });
  }

  // No staff role: check if client (move client only)
  const { data: move } = await supabase
    .from("moves")
    .select("id")
    .ilike("client_email", email)
    .limit(1)
    .maybeSingle();
  if (move) return NextResponse.json({ role: "client" });

  // partner_users → partner
  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("user_id")
    .eq("user_id", user.id)
    .single();
  if (partnerUser) return NextResponse.json({ role: "partner" });

  return NextResponse.json({ role: null });
}
