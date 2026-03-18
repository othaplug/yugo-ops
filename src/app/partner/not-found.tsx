import Link from "next/link";

export default function PartnerNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-4xl font-bold text-[var(--tx)] mb-2">Page not found</h1>
        <p className="text-[var(--tx2)] text-[13px] mb-6">This page doesn&apos;t exist or has been moved.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/partner"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
          >
            ← Back to dashboard
          </Link>
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@helloyugo.com"}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--tx)] transition-all"
          >
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}
