export const metadata = { title: "Slack messages" };
export const dynamic = "force-dynamic";

import MessagesPageClient from "./MessagesPageClient";

export default function AdminMessagesPage() {
  return <MessagesPageClient />;
}
