import { redirect } from "next/navigation";

/**
 * Deep link to a specific project in the partner portal.
 * Redirects to /partner with project pre-selected.
 */
export default async function PartnerProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/partner?project=${encodeURIComponent(id)}`);
}
