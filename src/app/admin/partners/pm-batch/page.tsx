import { redirect } from "next/navigation";

export const metadata = { title: "Schedule PM moves" };

export default async function PartnerPmBatchRedirect({
  searchParams,
}: {
  searchParams: Promise<{ partner_id?: string }>;
}) {
  const sp = await searchParams;
  const pid =
    typeof sp.partner_id === "string" ? sp.partner_id.trim() : "";

  const params = new URLSearchParams();
  params.set("mode", "pm_batch");
  if (pid) params.set("partner", pid);

  redirect(`/admin/moves/create?${params.toString()}`);
}
