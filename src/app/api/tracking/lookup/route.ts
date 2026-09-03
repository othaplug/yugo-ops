import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public tracking lookup. Returns a signed track URL for a move / delivery.
 *
 * SECURITY: the tracking token is the ONLY thing gating the track APIs (PII,
 * addresses, documents, photos, message threads, pay-balance). Record codes
 * (MV-…, DLV-…) are drawn from one shared incrementing sequence and are
 * therefore GUESSABLE, so this endpoint must not hand out a token on the code
 * alone — otherwise anyone could enumerate codes and mint a token for every
 * customer. We require the code AND the email on the booking as an ownership
 * proof, rate-limit by IP to blunt email brute-forcing, and return one generic
 * "not found" for both a missing record and a wrong email so the endpoint never
 * confirms which codes exist.
 */
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`tracking-lookup:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const { code, email } = await req.json();
    const q = (code || "").trim().replace(/^#/, "").toUpperCase();
    const emailQ = norm(email);

    if (!q || q.length < 3) {
      return NextResponse.json({ error: "Enter a valid tracking number" }, { status: 400 });
    }
    if (!emailQ || !emailQ.includes("@")) {
      return NextResponse.json(
        { error: "Enter the email address on your booking" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const base = getEmailBaseUrl();
    // One generic response for "no such code" AND "email doesn't match", so the
    // endpoint never reveals whether a given tracking number exists.
    const notFound = NextResponse.json(
      { error: "No match. Check your tracking number and the email on your booking." },
      { status: 404 },
    );

    const { data: move } = await supabase
      .from("moves")
      .select("id, move_code, client_email")
      .ilike("move_code", q)
      .limit(1)
      .maybeSingle();

    if (move) {
      if (norm(move.client_email) !== emailQ) return notFound;
      const token = signTrackToken("move", move.id);
      const url = `${base}/track/move/${encodeURIComponent(move.move_code)}?token=${token}`;
      return NextResponse.json({ url, type: "move", code: move.move_code });
    }

    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, delivery_number, customer_email, contact_email")
      .ilike("delivery_number", q)
      .limit(1)
      .maybeSingle();

    if (delivery) {
      const emails = [delivery.customer_email, delivery.contact_email].map(norm);
      if (!emails.includes(emailQ)) return notFound;
      const token = signTrackToken("delivery", delivery.id);
      const url = `${base}/track/delivery/${encodeURIComponent(delivery.delivery_number)}?token=${token}`;
      return NextResponse.json({ url, type: "delivery", code: delivery.delivery_number });
    }

    return notFound;
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
