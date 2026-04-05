import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { redirect } from "next/navigation";
import QuoteDetailClient from "./QuoteDetailClient";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { quoteId } = await params;
  return { title: `Quote ${quoteId}` };
}

export default async function QuoteDetailPage({ params }: Props) {
  const { quoteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = isSuperAdminEmail(user?.email);

  const db = createAdminClient();

  const { data: quote } = await db
    .from("quotes")
    .select("*, contacts:contact_id(id, name, email, phone)")
    .eq("quote_id", quoteId)
    .single();

  if (!quote) redirect("/admin/quotes");

  const { data: engagementRows } = await db
    .from("quote_engagement")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });

  const { data: legacyEvents } = await db
    .from("quote_events")
    .select("*")
    .eq("quote_id", quote.quote_id)
    .order("created_at", { ascending: true });

  const { count: followupsSentCount } = await db
    .from("quote_followups")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quote.id);

  const { data: maxFuRow } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "followup_max_attempts")
    .maybeSingle();

  const followupMaxAttempts = Math.max(
    0,
    parseInt(maxFuRow?.value || "3", 10) || 3,
  );

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <QuoteDetailClient
        quote={quote}
        engagement={engagementRows ?? []}
        legacyEvents={legacyEvents ?? []}
        isSuperAdmin={isSuperAdmin}
        followupsSentCount={followupsSentCount ?? 0}
        followupMaxAttempts={followupMaxAttempts}
      />
    </div>
  );
}
