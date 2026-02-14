import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase/server";



export async function GET() {
const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}