import { NextResponse } from "next/server";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("id, delivery_number")
    .eq("id", id)
    .single();
  if (error || !delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }
  const token = signTrackToken("delivery", delivery.id);
  const slug = delivery.delivery_number || delivery.id;
  const url = `${getEmailBaseUrl()}/track/delivery/${encodeURIComponent(slug)}?token=${token}`;
  return NextResponse.json({ url });
}
