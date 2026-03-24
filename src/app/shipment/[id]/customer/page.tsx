import { notFound } from "next/navigation";
import { Metadata } from "next";
import PublicInboundCustomerClient from "./PublicInboundCustomerClient";

export const metadata: Metadata = {
  title: "Provide delivery details",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

export default async function PublicInboundCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  return <PublicInboundCustomerClient id={id} token={token} />;
}
