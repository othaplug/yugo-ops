import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const logBodySchema = z.object({
  comm_type: z.string().min(1),
  channel: z.string().default("email"),
  subject: z.string().optional(),
  body_preview: z.string().optional(),
  recipient_kind: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("move_project_communications")
    .select("*")
    .eq("project_id", id)
    .order("sent_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = logBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const { data, error } = await db
    .from("move_project_communications")
    .insert({
      project_id: id,
      comm_type: b.comm_type,
      channel: b.channel,
      subject: b.subject ?? null,
      body_preview: b.body_preview ?? null,
      recipient_kind: b.recipient_kind ?? null,
      metadata: b.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
