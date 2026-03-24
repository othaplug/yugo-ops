import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

interface StopInput {
  address: string;
  lat?: number | null;
  lng?: number | null;
  stop_type: "pickup" | "dropoff";
  sort_order?: number;
  notes?: string | null;
}

/** POST /api/admin/job-stops — upsert additional stops for a job */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { job_type, job_id, stops } = body as {
      job_type: "move" | "quote" | "delivery";
      job_id: string;
      stops: StopInput[];
    };

    if (!job_type || !job_id || !Array.isArray(stops) || stops.length === 0) {
      return NextResponse.json({ error: "job_type, job_id, and stops[] are required" }, { status: 400 });
    }

    const validJobTypes = ["move", "quote", "delivery"];
    if (!validJobTypes.includes(job_type)) {
      return NextResponse.json({ error: "Invalid job_type" }, { status: 400 });
    }

    const admin = createAdminClient();

    const rows = stops
      .filter((s) => s.address?.trim())
      .map((s, i) => ({
        job_type,
        job_id,
        stop_type: s.stop_type,
        address: s.address.trim(),
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        sort_order: s.sort_order ?? i + 1,
        notes: s.notes ?? null,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    const { data, error: dbErr } = await admin
      .from("job_stops")
      .insert(rows)
      .select("id");

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data?.length ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** GET /api/admin/job-stops?job_type=move&job_id=xxx — fetch stops for a job */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const job_type = searchParams.get("job_type");
  const job_id = searchParams.get("job_id");

  if (!job_type || !job_id) {
    return NextResponse.json({ error: "job_type and job_id are required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error: dbErr } = await admin
      .from("job_stops")
      .select("*")
      .eq("job_type", job_type)
      .eq("job_id", job_id)
      .order("stop_type")
      .order("sort_order");

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ stops: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/job-stops?id=xxx — remove a single stop */
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const admin = createAdminClient();
    await admin.from("job_stops").delete().eq("id", id);
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
