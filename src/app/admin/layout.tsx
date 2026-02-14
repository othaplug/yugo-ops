import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./components/Sidebar";
import { ToastProvider } from "./components/Toast";
import RealtimeListener from "./components/RealtimeListener";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  return (
    <ToastProvider>
      <div>
        <Sidebar />
        <main className="ml-[220px] min-h-screen">
          <RealtimeListener />
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}