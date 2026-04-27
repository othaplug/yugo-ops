import { redirect } from "next/navigation";

export const metadata = { title: "Schedule PM moves" };

export default async function LegacyPmBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ partner_id?: string }>;
}) {
  const sp = await searchParams;
  const pid = typeof sp.partner_id === "string" ? sp.partner_id.trim() : "";
  redirect(
    pid
      ? `/admin/partners/pm-batch?partner_id=${encodeURIComponent(pid)}`
      : "/admin/partners/pm-batch",
  );
}
