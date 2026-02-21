import Link from "next/link";

/** Shown when partner portal is turned off. Linked from partner layout redirect. */
export default function PortalDisabledPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-heading text-[20px] font-bold text-[var(--tx)] mb-2">Partner portal is currently disabled</h1>
        <p className="text-[13px] text-[var(--tx3)] mb-6">
          Access to the partner portal has been turned off by your platform administrator. Please contact them if you need access.
        </p>
        <Link
          href="/partner/login"
          className="inline-block px-4 py-2.5 rounded-lg text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
