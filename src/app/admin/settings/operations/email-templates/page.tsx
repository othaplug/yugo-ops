import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Email templates" };

export default function OperationsEmailTemplatesRedirect() {
  redirect("/admin/platform?tab=app#email-templates");
}
