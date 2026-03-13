import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id?.trim() || "";
  const supabase = await createClient();
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    byUuid
      ? db.from("moves").select("*").eq("id", slug).single()
      : db.from("moves").select("*").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single(),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  if (byUuid && move.move_code?.trim()) {
    redirect(getMoveDetailPath(move));
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db.from("platform_users").select("role").eq("user_id", user?.id ?? "").single();
  const userRole = pu?.role ?? "viewer";

  const isOffice = move.move_type === "office";

  const [{ data: approvedChanges }, { data: approvedExtras }, { data: etaSmsLog }, { data: reviewRequest }] = await Promise.all([
    db.from("move_change_requests").select("fee_cents").eq("move_id", move.id).eq("status", "approved"),
    db.from("extra_items").select("fee_cents").eq("job_id", move.id).eq("job_type", "move").eq("status", "approved"),
    db.from("eta_sms_log").select("message_type, sent_at, eta_minutes, twilio_sid").eq("move_id", move.id).order("sent_at", { ascending: false }),
    db.from("review_requests").select("id, status, email_sent_at, review_clicked, review_clicked_at").eq("move_id", move.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const changeFeesCents = (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const extraFeesCents = (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const additionalFeesCents = changeFeesCents + extraFeesCents;

  return <MoveDetailClient move={move} crews={crews ?? []} isOffice={isOffice} userRole={userRole} additionalFeesCents={additionalFeesCents} etaSmsLog={etaSmsLog ?? []} reviewRequest={reviewRequest ?? undefined} />;
}
