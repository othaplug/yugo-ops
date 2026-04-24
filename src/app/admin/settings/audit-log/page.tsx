import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Audit log" };

export default function SettingsAuditLogRedirect() {
  redirect("/admin/audit-log");
}
