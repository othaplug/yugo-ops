import { createAdminClient } from "@/lib/supabase/admin";

type AuditAction =
  | "login"
  | "failed_login"
  | "view_client"
  | "view_quote"
  | "edit_move"
  | "edit_pricing"
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
 * Fire-and-forget audit log entry. Never blocks or throws.
 */
export function logAudit(entry: AuditEntry): void {
  try {
    const sb = createAdminClient();
    sb.from("audit_log")
      .insert({
        user_id: entry.userId ?? null,
        user_email: entry.userEmail ?? null,
        user_role: entry.userRole ?? null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        details: entry.details ?? null,
        ip_address: entry.ipAddress ?? null,
      })
      .then(() => {});
  } catch {
    // Audit failures must never break application flow
  }
}

export type { AuditAction, ResourceType };
