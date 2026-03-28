"use client";
import { useEffect } from "react";
import SectionError from "@/components/admin/SectionError";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // #region agent log
  useEffect(() => {
    fetch('/api/debug-capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'a968d1',location:'reports/error.tsx',message:'Reports error boundary caught',data:{message:error.message,stack:error.stack,digest:error.digest},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  }, [error]);
  // #endregion
  return <SectionError error={error} reset={reset} section="Reports" />;
}
