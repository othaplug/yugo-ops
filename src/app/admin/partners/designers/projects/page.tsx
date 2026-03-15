import { redirect } from "next/navigation";

export const metadata = { title: "Projects" };

export default function DesignerProjectsPage() {
  redirect("/admin/projects");
}
