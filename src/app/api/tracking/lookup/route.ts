import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const q = (code || "").trim().replace(/^#/, "").toUpperCase();

    if (!q || q.length < 3) {
      return NextResponse.json({ error: "Enter a valid tracking number" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const base = getEmailBaseUrl();

    const { data: move } = await supabase
      .from("moves")
      .select("id, move_code")
      .ilike("move_code", q)
      .limit(1)
      .maybeSingle();

    if (move) {
      const token = signTrackToken("move", move.id);
      const url = `${base}/track/move/${encodeURIComponent(move.move_code)}?token=${token}`;
      return NextResponse.json({ url, type: "move", code: move.move_code });
    }

    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, delivery_number")
      .ilike("delivery_number", q)
      .limit(1)
      .maybeSingle();

    if (delivery) {
      const token = signTrackToken("delivery", delivery.id);
      const url = `${base}/track/delivery/${encodeURIComponent(delivery.delivery_number)}?token=${token}`;
      return NextResponse.json({ url, type: "delivery", code: delivery.delivery_number });
    }

    return NextResponse.json({ error: "No move or delivery found with that tracking number" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
