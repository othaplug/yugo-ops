import Link from "next/link";
import NewClientForm from "./NewClientForm";

export const metadata = { title: "New Client" };

export default function NewClientPage() {
  return (
    <div className="w-full min-w-0 max-w-[min(600px,100%)] mx-auto py-5">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3"
      >
        ← Back
      </Link>
      <h1 className="admin-page-hero text-[var(--tx)] mb-4">Add Client</h1>
      <NewClientForm defaultPersona="client" clientOnly />
    </div>
  );
}
