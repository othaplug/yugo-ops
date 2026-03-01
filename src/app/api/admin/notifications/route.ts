import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (dbError) {
      // Table may not exist yet if migration not run - return empty
      if (dbError.code === "42P01" || dbError.message?.includes("does not exist")) {
        return NextResponse.json({ notifications: [] });
      }
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const body = await req.json();
  const { data, error: dbError } = await supabase
    .from("admin_notifications")
    .insert({ user_id: user.id, title: body.title, body: body.body, icon: body.icon, link: body.link })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}

export async function PATCH(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = await createClient();
    const body = await req.json();

    if (body.all === true && body.read === true) {
      const { error: updateErr } = await supabase
        .from("admin_notifications")
        .update({ read: true })
        .eq("user_id", user.id);
      if (updateErr && updateErr.code !== "42P01") return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const { error: updateErr } = await supabase
      .from("admin_notifications")
      .update({ read: body.read })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (updateErr && updateErr.code !== "42P01") return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
