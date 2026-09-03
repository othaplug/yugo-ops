import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Look up a move for the public "file a claim" flow.
 *
 * SECURITY: this used to accept a code OR an email alone. move_code is
 * guessable (shared incrementing sequence), so `?code=` alone harvested every
 * customer's name/email/phone, and `?email=` alone was an enumeration oracle
 * ("is this address a customer?") that also leaked the move UUID (which then
 * unlocks other UUID-keyed routes). We now require the code AND the matching
 * email as an ownership proof, rate-limit by IP, and return one generic 404 for
 * both a missing move and a wrong email so the endpoint confirms nothing.
 */
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`claims-lookup:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const emailQ = norm(searchParams.get("email"));

    if (!code || !emailQ) {
      return NextResponse.json(
        { error: "Enter your move code and the email on your booking" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const notFound = NextResponse.json(
      { error: "No match. Check your move code and the email on your booking." },
      { status: 404 },
    );

    const normalised = code.replace(/[-\s]/g, "").toUpperCase();
    const { data: moves } = await supabase
      .from("moves")
      .select("id, move_code, client_name, client_email, client_phone, valuation_tier, status")
      .or(`move_code.eq.${normalised},move_code.eq.${code.toUpperCase()}`)
      .order("scheduled_date", { ascending: false })
      .limit(1);

    if (!moves || moves.length === 0) return notFound;

    const move = moves[0];
    // Ownership proof: the supplied email must match the move's client_email.
    if (norm(move.client_email) !== emailQ) return notFound;

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
