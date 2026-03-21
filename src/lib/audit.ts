import { createAdminClient } from "@/lib/supabase/admin";

type AuditAction =
  | "login"
  | "failed_login"
  | "view_client"
  | "view_quote"
  | "edit_move"
  | "edit_pricing"
  | "edit_specialty_pricing"
  | "edit_b2b_surcharges"
  | "send_quote"
  | "export_data"
  | "change_role"
  | "delete_record"
  | "access_denied"
  | "move_status_change"
  | "quote_status_change"
  | "config_change"
  | "mfa_enrolled"
  | "mfa_verified";

type ResourceType =
  | "move"
  | "quote"
  | "contact"
  | "pricing"
  | "config"
  | "user"
  | "system";

interface AuditEntry {
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Persist an audit row. Awaits the insert so serverless handlers finish before the response
 * (fire-and-forget was dropping most writes). Never throws to callers.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("audit_log").insert({
      user_id: entry.userId ?? null,
      user_email: entry.userEmail ?? null,
      user_role: entry.userRole ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      details: entry.details ?? null,
      ip_address: entry.ipAddress ?? null,
    });
    if (error) {
      console.error("[audit] insert failed:", error.message, error.code);
    }
  } catch (e) {
    console.error("[audit] insert exception:", e);
  }
}

export type { AuditAction, ResourceType };
