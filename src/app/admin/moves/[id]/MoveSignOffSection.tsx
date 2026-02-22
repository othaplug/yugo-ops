"use client";

import { useEffect, useState } from "react";

type SignOff = {
  id: string;
  signed_by: string;
  signed_at: string;
  all_items_received: boolean;
  condition_accepted: boolean;
  satisfaction_rating: number | null;
  would_recommend: boolean | null;
  feedback_note: string | null;
  exceptions: string | null;
};

export default function MoveSignOffSection({ moveId }: { moveId: string }) {
  const [signOff, setSignOff] = useState<SignOff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/moves/${moveId}/signoff`)
      .then((r) => r.json())
      .then((d) => setSignOff(d))
      .catch(() => setSignOff(null))
      .finally(() => setLoading(false));
  }, [moveId]);

  if (loading) return <p className="text-[11px] text-[var(--tx3)]">Loading sign-off…</p>;
  if (!signOff) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Client sign-off
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
        <div><span className="text-[var(--tx3)]">Signed by:</span> {signOff.signed_by}</div>
        <div><span className="text-[var(--tx3)]">Date:</span> {new Date(signOff.signed_at).toLocaleString()}</div>
        <div><span className="text-[var(--tx3)]">Rating:</span> {signOff.satisfaction_rating ? `${signOff.satisfaction_rating}/5` : "—"}</div>
        <div><span className="text-[var(--tx3)]">All items received:</span> {signOff.all_items_received ? "Yes" : "No"}</div>
        <div><span className="text-[var(--tx3)]">Condition accepted:</span> {signOff.condition_accepted ? "Yes" : "No"}</div>
        <div><span className="text-[var(--tx3)]">Would recommend:</span> {signOff.would_recommend === true ? "Yes" : signOff.would_recommend === false ? "No" : "—"}</div>
      </div>
      {(signOff.feedback_note || signOff.exceptions) && (
        <div className="mt-2 pt-2 border-t border-[var(--brd)]">
          {signOff.feedback_note && <p className="text-[11px] text-[var(--tx2)]"><span className="text-[var(--tx3)]">Feedback:</span> {signOff.feedback_note}</p>}
          {signOff.exceptions && <p className="text-[11px] text-[var(--tx2)] mt-1"><span className="text-[var(--tx3)]">Exceptions:</span> {signOff.exceptions}</p>}
        </div>
      )}
    </div>
  );
}
