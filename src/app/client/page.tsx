"use client";

import Link from "next/link";

export default function ClientPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)] font-sans flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[var(--gdim)] border border-[rgba(201,169,98,0.35)] text-[var(--gold)] font-hero font-semibold tracking-widest text-sm mb-6">
          OPS+
        </span>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-[var(--tx)] mb-3">
          Track Your Move
        </h1>
        <p className="text-[13px] text-[var(--tx2)] leading-relaxed mb-6">
          Use the tracking link we sent to your email to view your move details, inventory, documents, and message your coordinator. No account or login required.
        </p>
        <p className="text-[11px] text-[var(--tx3)] mb-8">
          Can&apos;t find the link? Check your spam folder or contact your coordinator.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
