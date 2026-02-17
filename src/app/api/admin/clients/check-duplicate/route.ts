import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!platformUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const clientName = (body.client_name as string)?.trim()?.toLowerCase() || "";
    const clientEmail = (body.client_email as string)?.trim()?.toLowerCase() || "";
    const clientPhone = (body.client_phone as string)?.trim().replace(/\D/g, "") || "";

    if (!clientName && !clientEmail && !clientPhone) {
      return NextResponse.json({ exists: false });
    }

    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, contact_name, email, phone")
      .eq("type", "b2c");

    const normalizedPhone = (p: string) => p.replace(/\D/g, "");
    const match = (orgs || []).find((o) => {
      const oEmail = (o.email || "").trim().toLowerCase();
      const oPhone = normalizedPhone((o.phone || "").trim());
      const oName = (o.contact_name || o.name || "").trim().toLowerCase();
      if (clientEmail && oEmail && oEmail === clientEmail) return true;
      if (clientPhone && oPhone && oPhone === clientPhone) return true;
      if (clientName && oName && oName === clientName) return true;
      return false;
    });

    if (match) {
      return NextResponse.json({
        exists: true,
        org: { id: match.id, name: match.contact_name || match.name },
      });
    }
    return NextResponse.json({ exists: false });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check" },
      { status: 500 }
    );
  }
}
