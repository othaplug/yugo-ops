import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Business info" };

export default function OperationsBusinessInfoRedirect() {
  redirect("/admin/platform?tab=app#business-info");
}
