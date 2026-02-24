"use client";

import { useEffect, useState } from "react";

type SignOff = {
  id: string;
  signed_by: string;
  signed_at: string;
  signed_lat: number | null;
  signed_lng: number | null;
  all_items_received: boolean;
  condition_accepted: boolean;
  walkthrough_conducted_by_client: boolean;
  client_present_during_unloading: boolean;
  pre_existing_conditions_noted: boolean;
  photos_reviewed_by_client: boolean;
  satisfaction_rating: number | null;
  would_recommend: boolean | null;
  nps_score: number | null;
  no_issues_during_move: boolean;
  no_damages: boolean;
  no_property_damage: boolean;
  walkthrough_completed: boolean;
  crew_conducted_professionally: boolean;
  crew_wore_protection: boolean;
  furniture_reassembled: boolean;
  items_placed_correctly: boolean;
  property_left_clean: boolean;
  claims_process_explained: boolean;
  damage_report_deadline: string | null;
  escalation_triggered: boolean;
  escalation_reason: string | null;
  discrepancy_flags: string[];
  feedback_note: string | null;
  exceptions: string | null;
};

type Skip = {
  id: string;
  skip_reason: string;
  skip_note: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
};

function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="text-green-600 font-medium">Yes</span>;
  if (value === false) return <span className="text-red-500 font-medium">No</span>;
  return <span className="text-[var(--tx3)]">—</span>;
}

function NpsLabel({ score }: { score: number }) {
  if (score <= 6) return <span className="text-red-500 font-medium">Detractor ({score})</span>;
  if (score <= 8) return <span className="text-yellow-600 font-medium">Passive ({score})</span>;
  return <span className="text-green-600 font-medium">Promoter ({score})</span>;
}

const SKIP_REASON_LABELS: Record<string, string> = {
  client_not_home: "Client not home",
  client_refused: "Client refused to sign",
  client_requested_delay: "Client requested delay",
  emergency: "Emergency",
  other: "Other",
};

export default function MoveSignOffSection({ moveId }: { moveId: string }) {
  const [signOff, setSignOff] = useState<SignOff | null>(null);
  const [skips, setSkips] = useState<Skip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/moves/${moveId}/signoff`)
      .then((r) => r.json())
      .then((d) => {
        setSignOff(d.signOff || d);
        setSkips(d.skips || []);
      })
      .catch(() => setSignOff(null))
      .finally(() => setLoading(false));
  }, [moveId]);

  if (loading) return <p className="text-[11px] text-[var(--tx3)]">Loading sign-off…</p>;
  if (!signOff && skips.length === 0) return null;

  const deadlinePassed = signOff?.damage_report_deadline
    ? new Date(signOff.damage_report_deadline) < new Date()
    : false;

  return (
    <div className="space-y-3">
      {/* Escalation banner */}
      {signOff?.escalation_triggered && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-[11px] font-bold text-red-700 uppercase mb-1">Escalation Triggered</p>
          <p className="text-[11px] text-red-600">{signOff.escalation_reason}</p>
        </div>
      )}

      {/* Discrepancy flags */}
      {signOff?.discrepancy_flags && signOff.discrepancy_flags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[11px] font-bold text-amber-700 uppercase mb-1">Discrepancy Flags</p>
          {signOff.discrepancy_flags.map((f, i) => (
            <p key={i} className="text-[11px] text-amber-600">• {f}</p>
          ))}
        </div>
      )}

      {signOff && (
        <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)]">
              Client Sign-Off
            </h3>
            <a
              href={`/api/admin/moves/${moveId}/signoff/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-[var(--gold)] hover:underline"
            >
              Download PDF Receipt
            </a>
          </div>

          {/* Core info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
            <div><span className="text-[var(--tx3)]">Signed by:</span> {signOff.signed_by}</div>
            <div><span className="text-[var(--tx3)]">Date:</span> {new Date(signOff.signed_at).toLocaleString()}</div>
            <div><span className="text-[var(--tx3)]">Rating:</span> {signOff.satisfaction_rating ? `${signOff.satisfaction_rating}/5` : "—"}</div>
            <div><span className="text-[var(--tx3)]">NPS:</span> {signOff.nps_score != null ? <NpsLabel score={signOff.nps_score} /> : "—"}</div>
            <div><span className="text-[var(--tx3)]">Would recommend:</span> <YesNo value={signOff.would_recommend} /></div>
            {signOff.signed_lat != null && (
              <div><span className="text-[var(--tx3)]">Location:</span> {signOff.signed_lat.toFixed(4)}, {signOff.signed_lng?.toFixed(4)}</div>
            )}
          </div>

          {/* Damage window */}
          {signOff.damage_report_deadline && (
            <div className="mt-2 pt-2 border-t border-[var(--brd)]">
              <p className="text-[10px]">
                <span className="text-[var(--tx3)]">Damage report deadline:</span>{" "}
                <span className={deadlinePassed ? "text-[var(--tx3)]" : "text-red-500 font-medium"}>
                  {new Date(signOff.damage_report_deadline).toLocaleString()}
                  {deadlinePassed ? " (expired)" : " (active)"}
                </span>
              </p>
            </div>
          )}

          {/* Confirmations grid */}
          <div className="mt-2 pt-2 border-t border-[var(--brd)]">
            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-1.5">Confirmations</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div><span className="text-[var(--tx3)]">All items received:</span> <YesNo value={signOff.all_items_received} /></div>
              <div><span className="text-[var(--tx3)]">Condition accepted:</span> <YesNo value={signOff.condition_accepted} /></div>
              <div><span className="text-[var(--tx3)]">Walkthrough by client:</span> <YesNo value={signOff.walkthrough_conducted_by_client} /></div>
              <div><span className="text-[var(--tx3)]">Present during unloading:</span> <YesNo value={signOff.client_present_during_unloading} /></div>
              <div><span className="text-[var(--tx3)]">Pre-existing noted:</span> <YesNo value={signOff.pre_existing_conditions_noted} /></div>
              <div><span className="text-[var(--tx3)]">Photos reviewed:</span> <YesNo value={signOff.photos_reviewed_by_client} /></div>
              <div><span className="text-[var(--tx3)]">No issues:</span> <YesNo value={signOff.no_issues_during_move} /></div>
              <div><span className="text-[var(--tx3)]">No damages:</span> <YesNo value={signOff.no_damages} /></div>
              <div><span className="text-[var(--tx3)]">No property damage:</span> <YesNo value={signOff.no_property_damage} /></div>
              <div><span className="text-[var(--tx3)]">Walkthrough completed:</span> <YesNo value={signOff.walkthrough_completed} /></div>
              <div><span className="text-[var(--tx3)]">Crew professional:</span> <YesNo value={signOff.crew_conducted_professionally} /></div>
              <div><span className="text-[var(--tx3)]">Floor/wall protection:</span> <YesNo value={signOff.crew_wore_protection} /></div>
              <div><span className="text-[var(--tx3)]">Furniture reassembled:</span> <YesNo value={signOff.furniture_reassembled} /></div>
              <div><span className="text-[var(--tx3)]">Items in correct rooms:</span> <YesNo value={signOff.items_placed_correctly} /></div>
              <div><span className="text-[var(--tx3)]">Property left clean:</span> <YesNo value={signOff.property_left_clean} /></div>
            </div>
          </div>

          {/* Feedback & exceptions */}
          {(signOff.feedback_note || signOff.exceptions) && (
            <div className="mt-2 pt-2 border-t border-[var(--brd)]">
              {signOff.feedback_note && (
                <p className="text-[11px] text-[var(--tx2)]">
                  <span className="text-[var(--tx3)]">Feedback:</span> {signOff.feedback_note}
                </p>
              )}
              {signOff.exceptions && (
                <p className="text-[11px] text-red-500 mt-1">
                  <span className="text-[var(--tx3)]">Exceptions:</span> {signOff.exceptions}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skip records */}
      {skips.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-3">
          <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-amber-700 mb-2">
            Skip History ({skips.length})
          </h3>
          {skips.map((s) => (
            <div key={s.id} className="text-[11px] mb-2 last:mb-0">
              <p className="font-medium text-amber-800">
                {SKIP_REASON_LABELS[s.skip_reason] || s.skip_reason}
              </p>
              {s.skip_note && <p className="text-amber-700">{s.skip_note}</p>}
              <p className="text-amber-600/70 text-[10px]">
                {new Date(s.created_at).toLocaleString()}
                {s.location_lat != null && ` • ${s.location_lat.toFixed(4)}, ${s.location_lng?.toFixed(4)}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
