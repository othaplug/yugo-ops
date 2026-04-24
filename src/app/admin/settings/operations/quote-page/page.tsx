import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Quote page" };

export default function OperationsQuotePageRedirect() {
  redirect("/admin/platform?tab=app#quote-page");
}
