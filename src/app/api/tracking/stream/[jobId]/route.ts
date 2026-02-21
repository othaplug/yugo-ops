import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";

const POLL_MS = 5000;

/** GET SSE stream for a single job. Client passes token for auth. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const jobTypeParam = req.nextUrl.searchParams.get("jobType") || "";

  const admin = createAdminClient();
  let entityId: string;
  let jobType: "move" | "delivery";

  if (jobTypeParam === "delivery" || jobId.startsWith("PJ")) {
    const { data: d } = isUuid(jobId)
      ? await admin.from("deliveries").select("id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id").ilike("delivery_number", jobId).single();
    if (!d) return new Response("Not found", { status: 404 });
    if (!verifyTrackToken("delivery", d.id, token)) return new Response("Unauthorized", { status: 401 });
    entityId = d.id;
    jobType = "delivery";
  } else {
    const { data: m } = isUuid(jobId)
      ? await admin.from("moves").select("id").eq("id", jobId).single()
      : await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m) return new Response("Not found", { status: 404 });
    if (!verifyTrackToken("move", m.id, token)) return new Response("Unauthorized", { status: 401 });
    entityId = m.id;
    jobType = "move";
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastCheckpoints = "";
      let lastLocation = "";

      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const { data: session } = await admin
            .from("tracking_sessions")
            .select("status, last_location, checkpoints, is_active")
            .eq("job_id", entityId)
            .eq("job_type", jobType)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (session) {
            const cpStr = JSON.stringify(session.checkpoints || []);
            const locStr = JSON.stringify(session.last_location || {});
            if (cpStr !== lastCheckpoints) {
              lastCheckpoints = cpStr;
              send("checkpoint", { status: session.status, checkpoints: session.checkpoints });
            }
            if (locStr !== lastLocation) {
              lastLocation = locStr;
              if (session.last_location) send("location", session.last_location);
            }
          }
        } catch {
          // ignore
        }
      };

      await poll();
      const id = setInterval(poll, POLL_MS);
      req.signal.addEventListener("abort", () => clearInterval(id));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
