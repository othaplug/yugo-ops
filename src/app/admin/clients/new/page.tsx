import Topbar from "../../components/Topbar";
import Link from "next/link";
import NewClientForm from "./NewClientForm";

export default function NewClientPage() {
  return (
    <>
      <Topbar title="Add Client" subtitle="Onboard a new partner or B2C client" />
      <div className="max-w-[600px] px-6 py-5">
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3">
          ← Back
        </Link>
        <NewClientForm />
      </div>
    </>
  );
}