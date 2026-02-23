import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-4xl font-bold text-[var(--tx)] mb-2">404</h1>
        <p className="text-[var(--tx2)] text-[13px] mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
          >
            ← Command Center
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
