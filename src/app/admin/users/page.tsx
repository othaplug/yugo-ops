export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

import { isSuperAdminEmail } from "@/lib/super-admin";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  if (!isSuperAdmin) redirect("/admin");

  return <UsersClient currentUserId={user?.id} />;
}
