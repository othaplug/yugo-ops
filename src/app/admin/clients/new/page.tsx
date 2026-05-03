import { redirect } from "next/navigation";

/** Manual add-client form retired; move clients emerge from bookings and CRM elsewhere. */
export const metadata = { title: "Clients" };

export default function LegacyNewClientRedirect() {
  redirect("/admin/clients");
}
