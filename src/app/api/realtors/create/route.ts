import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const { agent_name, email, brokerage } = await req.json();

    if (!agent_name || typeof agent_name !== "string") {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("realtors")
      .insert({
        agent_name: agent_name.trim(),
        email: (email || "").trim() || null,
        brokerage: (brokerage || "").trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create realtor" }, { status: 500 });
  }
}
