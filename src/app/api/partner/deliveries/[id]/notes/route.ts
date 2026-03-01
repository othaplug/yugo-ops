import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, organization_id, instructions")
    .eq("id", id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (delivery.organization_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: notes } = await supabase
    .from("delivery_notes")
    .select("id, content, author_name, created_at")
    .eq("delivery_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ notes: notes || [], instructions: delivery.instructions || "" });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, organization_id, instructions")
    .eq("id", id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (delivery.organization_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const { data: note, error: dbErr } = await supabase
    .from("delivery_notes")
    .insert({
      delivery_id: id,
      content: content.trim(),
      author_name: "Partner",
    })
    .select("id, content, author_name, created_at")
    .single();

  if (dbErr) {
    const merged = [delivery.instructions, content.trim()].filter(Boolean).join("\n---\n");
    await supabase
      .from("deliveries")
      .update({ instructions: merged })
      .eq("id", id);
    return NextResponse.json({
      note: {
        id: crypto.randomUUID(),
        content: content.trim(),
        author_name: "Partner",
        created_at: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({ note });
}
