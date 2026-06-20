import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { isDispatchJobInProgress } from "@/lib/dispatch-job-in-progress";
import {
  fetchCrewAssignmentSnapshot,
  resolveAssignedMembers,
} from "@/lib/crew-job-snapshot";
import { logAudit } from "@/lib/audit";
import { isSuperAdminEmail } from "@/lib/super-admin";

/** PATCH: Assign crew to a move or delivery. Staff only. */
export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const adminCtx = { isSuperAdmin: isSuperAdminEmail(user?.email) };

  try {
    const body = await req.json().catch(() => ({}));
    const { jobId, jobType, crewId, members, override } = body as {
      jobId: string;
      jobType: "move" | "delivery";
      crewId: string | null;
      members?: string[] | null;
      /** Super-admin only: bypass the in-progress lock to fix an
       *  assignment mistake. Audit-logged so the change is traceable. */
      override?: boolean;
    };

    if (!jobId || !jobType) {
      return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
    }
    if (jobType !== "move" && jobType !== "delivery") {
      return NextResponse.json({ error: "jobType must be move or delivery" }, { status: 400 });
    }

    const admin = createAdminClient();
    const table = jobType === "move" ? "moves" : "deliveries";
    const codeCol = jobType === "move" ? "move_code" : "delivery_number";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

    const selectCols = "id, status, stage, crew_id, assigned_members";
    const { data: existing } = isUuid
      ? await admin.from(table).select(selectCols).eq("id", jobId).maybeSingle()
      : await admin.from(table).select(selectCols).ilike(codeCol, jobId).maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // members-only update: save assigned_members without changing the crew.
    // Same in-progress gate applies — checking-out one wrong member during
    // a live job is still a crew change, so require override + super admin.
    if (crewId === undefined && Array.isArray(members)) {
      if (isDispatchJobInProgress(existing.status, existing.stage)) {
        if (!override || !adminCtx?.isSuperAdmin) {
          return NextResponse.json(
            {
              error:
                "Cannot edit members: job is in progress. Member changes are only allowed before the crew has started.",
            },
            { status: 400 },
          );
        }
      }
      const cleanMembers = members.filter((m) => typeof m === "string" && m.trim());
      const { data: updated, error } = await admin
        .from(table)
        .update({ assigned_members: cleanMembers, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (override && adminCtx?.isSuperAdmin) {
        await logAudit({
          userId: user?.id,
          userEmail: user?.email,
          action: "crew_members_changed_in_progress",
          resourceType: jobType,
          resourceId: existing.id,
          details: { members: cleanMembers, status: existing.status, stage: existing.stage },
        });
      }
      return NextResponse.json({ ok: true, [jobType]: updated });
    }

    const jobInProgress = isDispatchJobInProgress(existing.status, existing.stage);
    if (jobInProgress) {
      // Super-admin override allows fixing an assignment mistake on an
      // in-progress move. Other admins still hit the original lock.
      if (!override || !adminCtx?.isSuperAdmin) {
        return NextResponse.json(
          {
            error:
              "Cannot reassign: job is in progress. Reassignment is only allowed before the crew has started.",
          },
          { status: 400 },
        );
      }
    }

    const trimmedCrew = crewId && String(crewId).trim() ? String(crewId).trim() : null;
    const update: Record<string, unknown> = {
      crew_id: trimmedCrew,
      updated_at: new Date().toISOString(),
    };

    if (trimmedCrew) {
      const snap = await fetchCrewAssignmentSnapshot(admin, trimmedCrew);
      // If caller supplied explicit members, use those; otherwise use crew snapshot
      if (Array.isArray(members)) {
        update.assigned_members = members.filter((m) => typeof m === "string" && m.trim());
        update.assigned_crew_name = snap.assigned_crew_name;
      } else {
        // No explicit members: keep an existing subset when the crew is the
        // same; only snapshot the full roster on a genuinely new crew.
        update.assigned_members = resolveAssignedMembers({
          previousCrewId: (existing as { crew_id?: string | null }).crew_id,
          nextCrewId: trimmedCrew,
          existingMembers: (existing as { assigned_members?: unknown }).assigned_members,
          snapshotMembers: snap.assigned_members,
        });
        update.assigned_crew_name = snap.assigned_crew_name;
      }
    } else {
      update.assigned_members = [];
      update.assigned_crew_name = null;
    }

    const { data: updated, error } = await admin
      .from(table)
      .update(update)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (override && adminCtx?.isSuperAdmin && jobInProgress) {
      await logAudit({
        userId: user?.id,
        userEmail: user?.email,
        action: "crew_reassigned_in_progress",
        resourceType: jobType,
        resourceId: existing.id,
        details: {
          new_crew_id: trimmedCrew,
          status: existing.status,
          stage: existing.stage,
          assigned_members: update.assigned_members,
        },
      });
    }
    return NextResponse.json({ ok: true, [jobType]: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign crew" },
      { status: 500 }
    );
  }
}
