import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const BUCKET = "expense-receipts";

/** Get signed URL for expense receipt image. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: exp } = await admin
    .from("crew_expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .eq("team_id", payload.teamId)
    .single();

  if (!exp?.receipt_storage_path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(exp.receipt_storage_path, 3600);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
