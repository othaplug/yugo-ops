import { redirect } from "next/navigation";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  redirect("/admin/deliveries?view=projects");
}
