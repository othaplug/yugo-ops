import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = (user.email || "").toLowerCase() === "othaplug@gmail.com";
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const isAdmin = isSuperAdmin || platformUser?.role === "admin" || platformUser?.role === "manager";

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, string> = {};

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.type === "string") {
      const valid = ["retail", "designer", "hospitality", "gallery", "realtor"];
      if (valid.includes(body.type)) updates.type = body.type;
    }
    if (typeof body.contact_name === "string") updates.contact_name = body.contact_name.trim();
    if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (typeof body.phone === "string") updates.phone = body.phone.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("organizations").update(updates).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 }
    );
  }
}
