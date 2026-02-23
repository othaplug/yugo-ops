import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import BackButton from "../components/BackButton";
import ChangeRequestsClient from "./ChangeRequestsClient";

export default async function ChangeRequestsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("move_change_requests")
    .select(`
      id,
      move_id,
      type,
      description,
      urgency,
      status,
      created_at,
      moves (
        id,
        client_name,
        client_email,
        move_code,
        from_address,
        to_address,
        scheduled_date
      )
    `)
    .order("created_at", { ascending: false });

  const pending = (requests || []).filter((r: any) => r.status === "pending");
  const reviewed = (requests || []).filter((r: any) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-5 md:px-6 md:py-6 animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <BackButton label="Back" />
      </div>
      <h1 className="font-heading text-[20px] font-bold text-[var(--tx)] mb-1">Change Requests</h1>
      <p className="text-[12px] text-[var(--tx3)] mb-5">
        Client-submitted change requests. Review and approve or reject.
      </p>
      <ChangeRequestsClient
        pending={pending}
        reviewed={reviewed}
      />
    </div>
  );
}
