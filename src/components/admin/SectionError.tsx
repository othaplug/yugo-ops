"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  section?: string;
}

export default function SectionError({ error, reset, section }: SectionErrorProps) {
  useEffect(() => {
    console.error(`[${section ?? "admin"} error]`, error);
    // #region agent log
    fetch('/api/debug-capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'a968d1',location:`SectionError/${section}`,message:'Section error boundary caught',data:{message:error.message,stack:error.stack,digest:error.digest},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }, [error, section]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--rdim)] flex items-center justify-center">
          <WarningCircle size={24} color="var(--red)" aria-hidden />
        </div>
        <div>
          <h2 className="admin-section-h2">
            {section ? `${section} failed to load` : "Something went wrong"}
          </h2>
          <p className="text-[12px] text-[var(--tx3)] mt-1.5 leading-relaxed">
            {error.message && !error.message.includes("fetch")
              ? error.message
              : "An unexpected error occurred. Your data is safe."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-[var(--tx3)]/50 mt-1 font-mono">
              ref: {error.digest}
            </p>
          )}
          {/* #region agent log */}
          {error.stack && <pre style={{fontSize:'8px',textAlign:'left',opacity:0.4,maxHeight:'100px',overflow:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',marginTop:'8px'}}>{error.stack}</pre>}
          {/* #endregion */}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors touch-manipulation"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors touch-manipulation"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
