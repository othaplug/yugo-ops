import { redirect } from "next/navigation";

/**
 * Review landing — no star page any more (Google policy: no gating). Any old
 * /review?token or ?id link just forwards to the redirect route, which logs the
 * click (stopping the cadence) and 302s straight to Google's review box.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; id?: string }>;
}) {
  const { token, id } = await searchParams;
  const qs = new URLSearchParams();
  if (token) qs.set("token", token);
  if (id) qs.set("id", id);
  redirect(`/api/review/redirect?${qs.toString()}`);
}
