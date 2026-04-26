import BackButton from "../../components/BackButton"
import { NewLeadForm } from "./NewLeadForm"

export const metadata = { title: "New lead" }
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function NewLeadPage() {
  return (
    <div className="w-full min-w-0 max-w-[min(600px,100%)] mx-auto py-5">
      <BackButton label="Back to leads" fallback="/admin/leads" className="mb-3" />
      <h1 className="admin-page-hero text-[var(--tx)] mb-6">New lead</h1>
      <div className="rounded-2xl border border-[var(--brd)]/50 bg-[var(--card)] p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <NewLeadForm />
      </div>
    </div>
  )
}
