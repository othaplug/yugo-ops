import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

import { getSuperAdminEmail } from "@/lib/super-admin";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = (user?.email || "").toLowerCase() === getSuperAdminEmail();
  if (!isSuperAdmin) redirect("/admin");

  return <UsersClient currentUserId={user?.id} />;
}
