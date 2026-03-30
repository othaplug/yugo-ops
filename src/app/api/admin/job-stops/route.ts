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

    if (job_type === "quote") {
      const { data: q } = await admin
        .from("quotes")
        .select("factors_applied, from_address, to_address, from_access, to_access")
        .eq("quote_id", job_id)
        .maybeSingle();
      if (q) {
        const { data: allStops } = await admin
          .from("job_stops")
          .select("stop_type, address, sort_order")
          .eq("job_type", "quote")
          .eq("job_id", job_id)
          .order("sort_order", { ascending: true });
        const pickups = (allStops ?? [])
          .filter((s) => s.stop_type === "pickup")
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const dropoffs = (allStops ?? [])
          .filter((s) => s.stop_type === "dropoff")
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const pickup_locations = [
          {
            address: String(q.from_address ?? "").trim(),
            access: q.from_access != null && String(q.from_access).trim() ? String(q.from_access).trim() : null,
          },
          ...pickups.map((s) => ({
            address: String(s.address ?? "").trim(),
            access: null as string | null,
          })),
        ].filter((r) => r.address.length > 0);
        const dropoff_locations = [
          {
            address: String(q.to_address ?? "").trim(),
            access: q.to_access != null && String(q.to_access).trim() ? String(q.to_access).trim() : null,
          },
          ...dropoffs.map((s) => ({
            address: String(s.address ?? "").trim(),
            access: null as string | null,
          })),
        ].filter((r) => r.address.length > 0);
        const prev =
          q.factors_applied && typeof q.factors_applied === "object" && !Array.isArray(q.factors_applied)
            ? (q.factors_applied as Record<string, unknown>)
            : {};
        await admin
          .from("quotes")
          .update({
            factors_applied: {
              ...prev,
              pickup_locations,
              dropoff_locations,
              multi_pickup: pickup_locations.length > 1,
              multi_dropoff: dropoff_locations.length > 1,
            },
          })
          .eq("quote_id", job_id);
      }
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
