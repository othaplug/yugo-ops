import { redirect } from "next/navigation";

export const metadata = { title: "New Move" };

export default async function LegacyNewMoveRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? String(value[value.length - 1] ?? "") : value);
  }

  const qs = params.toString();
  redirect(qs ? `/admin/moves/create?${qs}` : "/admin/moves/create");
}
