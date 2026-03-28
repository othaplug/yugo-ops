import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Insert using any Supabase client (e.g. user session — RLS allows authenticated inserts). */
export async function insertAuditLog(client: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { error } = await client.from("audit_log").insert({
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
}

/**
 * Persist an audit row. Awaits the insert so serverless handlers finish before the response
 * (fire-and-forget was dropping most writes). Never throws to callers.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sb = createAdminClient();
    await insertAuditLog(sb, entry);
  } catch (e) {
    console.error("[audit] insert exception:", e);
  }
}

export type { AuditAction, ResourceType };
