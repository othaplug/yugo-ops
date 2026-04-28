"use client";

import Link from "next/link";

export function ManifestPrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-2 text-xs font-bold uppercase tracking-wide border border-zinc-400 bg-zinc-100 hover:bg-zinc-200"
      >
        Print
      </button>
      <Link
        href={backHref}
        className="px-3 py-2 text-xs font-semibold text-center border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
      >
        Back to job
      </Link>
    </div>
  );
}
