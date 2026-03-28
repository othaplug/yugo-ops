import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeadAssignmentMode } from "./assignment-mode";

const ASSIGNEE_ROLES = ["owner", "coordinator", "sales"] as const;

const OPEN_LEAD_STATUSES = ["new", "assigned", "contacted", "qualified", "follow_up"] as const;

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export async function assignLeadToRep(
  sb: SupabaseClient,
  leadId: string,
  repUserId: string,
  performedBy?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await sb
    .from("leads")
    .update({
      assigned_to: repUserId,
      assigned_at: now,
      status: "assigned",
    })
    .eq("id", leadId);

  await sb.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "assigned",
    performed_by: performedBy ?? repUserId,
    notes: null,
  });
}

async function roundRobinAssign(
  sb: SupabaseClient,
  leadId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 1) {
    await assignLeadToRep(sb, leadId, ids[0]!);
    return;
  }

  const { data: lastAssigned } = await sb
    .from("leads")
    .select("assigned_to")
    .not("assigned_to", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastId = lastAssigned?.assigned_to as string | undefined;
  const lastIdx = lastId ? ids.findIndex((u) => u === lastId) : -1;
  const nextIdx = (lastIdx + 1) % ids.length;
  const nextRep = ids[nextIdx]!;
  await assignLeadToRep(sb, leadId, nextRep);
}

async function smartAssign(sb: SupabaseClient, leadId: string, ids: string[]): Promise<void> {
  if (ids.length === 1) {
    await assignLeadToRep(sb, leadId, ids[0]!);
    return;
  }

  const { data: leadRow } = await sb.from("leads").select("service_type, source, estimated_value").eq("id", leadId).maybeSingle();
  const lead = leadRow as { service_type?: string | null; source?: string | null; estimated_value?: number | null } | null;
  const serviceType = (lead?.service_type || "").trim().toLowerCase();
  const source = (lead?.source || "").trim();
  const estVal = Number(lead?.estimated_value ?? 0) || 0;

  const { data: repRows } = await sb
    .from("platform_users")
    .select("user_id, role, specializations, on_vacation, out_of_office, max_open_leads")
    .in("user_id", ids);

  const repMeta = new Map<
    string,
    {
      role: string;
      specializations: string[] | null;
      on_vacation: boolean;
      out_of_office: boolean;
      max_open_leads: number | null;
    }
  >();
  for (const r of repRows ?? []) {
    const uid = r.user_id as string;
    repMeta.set(uid, {
      role: String(r.role || ""),
      specializations: Array.isArray(r.specializations) ? (r.specializations as string[]) : null,
      on_vacation: !!r.on_vacation,
      out_of_office: !!r.out_of_office,
      max_open_leads: typeof r.max_open_leads === "number" ? r.max_open_leads : 20,
    });
  }

  const { data: recentAssignments } = await sb
    .from("leads")
    .select("assigned_to")
    .not("assigned_to", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(3);

  const recentCounts = new Map<string, number>();
  for (const a of recentAssignments ?? []) {
    const u = a.assigned_to as string;
    recentCounts.set(u, (recentCounts.get(u) ?? 0) + 1);
  }

  const since = thirtyDaysAgoIso();
  const scored = await Promise.all(
    ids.map(async (repId) => {
      const meta = repMeta.get(repId) ?? {
        role: "",
        specializations: null,
        on_vacation: false,
        out_of_office: false,
        max_open_leads: 20,
      };

      let score = 50;

      const specs = (meta.specializations ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      if (serviceType && specs.some((s) => s === serviceType || serviceType.includes(s) || s.includes(serviceType))) {
        score += 20;
      }
      if (source === "partner_referral" && meta.role === "sales") score += 15;
      if (estVal > 2000 && meta.role === "owner") score += 10;

      const { count: openLeads } = await sb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", repId)
        .in("status", [...OPEN_LEAD_STATUSES]);

      const open = openLeads ?? 0;
      const maxOpen = meta.max_open_leads ?? 20;
      if (open >= maxOpen) {
        score -= 5000;
      } else {
        score -= open * 3;
      }

      const { data: recentPerformance } = await sb
        .from("leads")
        .select("status")
        .eq("assigned_to", repId)
        .gte("created_at", since);

      if (recentPerformance && recentPerformance.length > 0) {
        const converted = recentPerformance.filter((l) => l.status === "converted").length;
        const conversionRate = converted / recentPerformance.length;
        score += conversionRate * 30;
      }

      if (meta.on_vacation || meta.out_of_office) score -= 100;

      const recentToThisRep = recentCounts.get(repId) ?? 0;
      score -= recentToThisRep * 10;

      return { repId, score };
    })
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.repId.localeCompare(b.repId);
  });

  const winner = scored[0]?.repId ?? ids[0]!;
  await assignLeadToRep(sb, leadId, winner);
}

export async function autoAssignLead(sb: SupabaseClient, leadId: string): Promise<void> {
  const mode = await getLeadAssignmentMode(sb);
  if (mode === "manual") return;

  const { data: reps, error } = await sb
    .from("platform_users")
    .select("user_id, role")
    .in("role", [...ASSIGNEE_ROLES]);

  if (error || !reps?.length) return;

  const ids = reps.map((r) => r.user_id as string).filter(Boolean);
  if (ids.length === 0) return;

  if (mode === "round_robin") {
    await roundRobinAssign(sb, leadId, ids);
    return;
  }

  await smartAssign(sb, leadId, ids);
}
