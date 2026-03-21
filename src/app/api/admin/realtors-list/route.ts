import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const db = createAdminClient();
    const [{ data: realtors, error: rErr }, { data: referrals, error: refErr }] = await Promise.all([
      db.from("realtors").select("id, agent_name, email, brokerage, created_at").order("agent_name"),
      db.from("referrals").select("agent_id"),
    ]);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 });

    const countByAgent = new Map<string, number>();
    for (const row of referrals || []) {
      const aid = row.agent_id as string | null;
      if (!aid) continue;
      countByAgent.set(aid, (countByAgent.get(aid) ?? 0) + 1);
    }

    const rows = (realtors || []).map((r) => ({
      id: r.id,
      agent_name: r.agent_name,
      email: r.email,
      brokerage: r.brokerage,
      created_at: r.created_at,
      referral_count: countByAgent.get(r.id) ?? 0,
    }));

    return NextResponse.json({ realtors: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load realtors";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
