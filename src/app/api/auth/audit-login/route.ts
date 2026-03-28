import { NextResponse } from "next/server";
import { createClient as createJwtSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { insertAuditLog } from "@/lib/audit";

/**
 * Records a login audit row after password (or other client-side) sign-in.
 * Accepts either cookie session or Authorization: Bearer <access_token> from the fresh sign-in response.
 */
export async function POST(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  let userClient: SupabaseClient;
  let userId: string;
  let userEmail: string | undefined;

  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    userClient = createJwtSupabaseClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
    userEmail = user.email;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userClient = supabase;
    userId = user.id;
    userEmail = user.email ?? undefined;
  }

  await insertAuditLog(userClient, {
    userId,
    userEmail: userEmail ?? null,
    action: "login",
    resourceType: "system",
    details: { method: bearer ? "password" : "session" },
  });

  return NextResponse.json({ ok: true });
}
