import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getPlatformToggles } from "@/lib/platform-settings";

const POLL_MS = 5000;

/** GET SSE stream for all active sessions. Staff only; requires crew tracking enabled. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const toggles = await getPlatformToggles();
  if (!toggles.crew_tracking) {
    return new Response("Crew tracking is disabled", { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastData = "";

      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const admin = createAdminClient();
          const { data: sessions } = await admin
            .from("tracking_sessions")
            .select("id, job_id, job_type, status, last_location, updated_at, team_id")
            .eq("is_active", true)
            .order("updated_at", { ascending: false });

          const teamIds = [...new Set((sessions || []).map((s) => s.team_id))];
          const { data: crews } = teamIds.length ? await admin.from("crews").select("id, name").in("id", teamIds) : { data: [] };
          const teamMap = new Map((crews || []).map((c) => [c.id, c.name]));

          const moveIds = (sessions || []).filter((s) => s.job_type === "move").map((s) => s.job_id);
          const deliveryIds = (sessions || []).filter((s) => s.job_type === "delivery").map((s) => s.job_id);
          const { data: moves } = moveIds.length ? await admin.from("moves").select("id, client_name, move_code").in("id", moveIds) : { data: [] };
          const { data: deliveries } = deliveryIds.length ? await admin.from("deliveries").select("id, customer_name, client_name, delivery_number").in("id", deliveryIds) : { data: [] };
          const moveMap = new Map((moves || []).map((m) => [m.id, m]));
          const deliveryMap = new Map((deliveries || []).map((d) => [d.id, d]));

          const sessionsWithDetails = (sessions || []).map((s) => {
            const job = s.job_type === "move" ? moveMap.get(s.job_id) : deliveryMap.get(s.job_id);
            const jobName = job ? (s.job_type === "move" ? (job as any).client_name : `${(job as any).customer_name} (${(job as any).client_name})`) : "—";
            const jobId = job ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number) : s.job_id;
            const detailHref = s.job_type === "move" ? `/admin/moves/${jobId}` : `/admin/deliveries/${jobId}`;
            return {
              id: s.id,
              job_id: s.job_id,
              job_type: s.job_type,
              jobId,
              jobName,
              status: s.status,
              lastLocation: s.last_location,
              updatedAt: s.updated_at,
              team_id: s.team_id,
              teamName: teamMap.get(s.team_id) || "—",
              detailHref,
            };
          });

          const dataStr = JSON.stringify(sessionsWithDetails);
          if (dataStr !== lastData) {
            lastData = dataStr;
            send("sessions", { sessions: sessionsWithDetails });
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
