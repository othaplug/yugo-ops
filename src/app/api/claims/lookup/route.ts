import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const email = searchParams.get("email");

    if (!code && !email) {
      return NextResponse.json({ error: "Provide a move code or email address" }, { status: 400 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("moves")
      .select("id, move_code, client_name, client_email, client_phone, valuation_tier, status");

    if (code) {
      const normalised = code.replace(/[-\s]/g, "").toUpperCase();
      query = query.or(`move_code.eq.${normalised},move_code.eq.${code.toUpperCase()}`);
    } else if (email) {
      query = query.ilike("client_email", email);
    }

    const { data: moves } = await query.order("scheduled_date", { ascending: false }).limit(1);

    if (!moves || moves.length === 0) {
      return NextResponse.json({ error: "No move found. Please check the reference and try again." }, { status: 404 });
    }

    const move = moves[0];

    return NextResponse.json({
      move: {
        id: move.id,
        move_code: move.move_code,
        client_name: move.client_name,
        client_email: move.client_email,
        client_phone: move.client_phone,
        valuation_tier: move.valuation_tier || "released",
        was_upgraded: false,
        status: move.status || null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
