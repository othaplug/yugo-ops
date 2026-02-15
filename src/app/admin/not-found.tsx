import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-4xl font-bold text-[var(--tx)] mb-2">404</h1>
        <p className="text-[var(--tx2)] text-[13px] mb-6">This page doesn&apos;t exist or has been moved.</p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
        >
          ← Back to Command Center
        </Link>
      </div>
    </div>
  );
}
