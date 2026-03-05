"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Send, CheckCircle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EditQuoteClientProps {
  originalQuote: any;
  addons: any[];
  config: Record<string, string>;
}

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_delivery: "B2B Delivery",
};

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function EditQuoteClient({ originalQuote, addons, config }: EditQuoteClientProps) {
  const router = useRouter();
  const oq = originalQuote;
  const contact = Array.isArray(oq.contacts) ? oq.contacts[0] : oq.contacts;

  const [serviceType] = useState(oq.service_type);
  const [fromAddress, setFromAddress] = useState(oq.from_address || "");
  const [toAddress, setToAddress] = useState(oq.to_address || "");
  const [fromAccess, setFromAccess] = useState(oq.from_access || "");
  const [toAccess, setToAccess] = useState(oq.to_access || "");
  const [moveDate, setMoveDate] = useState(oq.move_date || "");
  const [moveSize, setMoveSize] = useState(oq.move_size || "");
  const [reason, setReason] = useState("");

  const [generating, setGenerating] = useState(false);
  const [newQuoteResult, setNewQuoteResult] = useState<any>(null);
  const [newQuoteId, setNewQuoteId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factors = (oq.factors_applied ?? {}) as Record<string, any>;

  const oldPrice = oq.tiers?.essentials?.price ?? oq.custom_price ?? 0;

  const handleRegenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    try {
      const payload: Record<string, any> = {
        service_type: serviceType,
        from_address: fromAddress,
        to_address: toAddress,
        from_access: fromAccess || undefined,
        to_access: toAccess || undefined,
        move_date: moveDate || undefined,
        move_size: moveSize || undefined,
        contact_id: contact?.id || oq.contact_id,
        hubspot_deal_id: oq.hubspot_deal_id || undefined,
      };

      if (factors.company_name) payload.company_name = factors.company_name;
      if (factors.item_description) payload.item_description = factors.item_description;
      if (factors.item_category) payload.item_category = factors.item_category;
      if (factors.square_footage) payload.square_footage = factors.square_footage;
      if (factors.workstation_count) payload.workstation_count = factors.workstation_count;
      if (factors.project_type) payload.project_type = factors.project_type;

      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate quote");
        return;
      }

      setNewQuoteResult(data);
      setNewQuoteId(data.quote_id);
    } catch {
      setError("Network error generating quote");
    } finally {
      setGenerating(false);
    }
  }, [serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, moveSize, contact, oq, factors]);

  const handleSendUpdate = useCallback(async () => {
    if (!newQuoteId) return;
    setError(null);
    setLinking(true);
    try {
      const res = await fetch("/api/quotes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalQuoteId: oq.quote_id,
          newQuoteId,
          reason: reason.trim() || undefined,
          sendToClient: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to link quote");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setLinking(false);
    }
  }, [newQuoteId, oq.quote_id, reason]);

  const newPrice = newQuoteResult?.tiers?.essentials?.price ?? newQuoteResult?.custom_price?.price ?? null;

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all";
  const labelClass = "block text-[11px] font-semibold text-[var(--tx2)] mb-1.5";

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--green)]/10 flex items-center justify-center">
          <CheckCircle className="text-[var(--green)]" size={28} />
        </div>
        <h1 className="text-xl font-bold text-[var(--tx)] mb-2">Quote Updated & Sent</h1>
        <p className="text-sm text-[var(--tx2)] mb-1">
          {oq.quote_id} has been superseded by <strong className="text-[var(--gold)]">{newQuoteId}</strong>.
        </p>
        <p className="text-sm text-[var(--tx3)] mb-8">
          {contact?.email ? `The updated quote has been emailed to ${contact.email}.` : "The new quote is ready."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/admin/quotes")}
            className="px-5 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)]"
          >
            Back to Quotes
          </button>
          <button
            onClick={() => router.push(`/admin/quotes/${newQuoteId}/edit`)}
            className="px-5 py-2.5 rounded-lg bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90"
          >
            View New Quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">Re-Quote</div>
          <h1 className="text-lg font-bold text-[var(--tx)]">
            Edit Quote {oq.quote_id}
            <span className="text-sm font-normal text-[var(--tx3)] ml-2">v{oq.version || 1}</span>
          </h1>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)]">
          {SERVICE_LABELS[serviceType] || serviceType}
        </span>
      </div>

      {/* Current quote summary */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
        <div className="text-[9px] font-bold text-[var(--tx3)] tracking-widest uppercase mb-3">Current Quote</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Client</div>
            <div className="text-[var(--tx)] font-medium">{contact?.name || "—"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Price</div>
            <div className="text-[var(--gold)] font-bold">{formatCurrency(Number(oldPrice))}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Move Date</div>
            <div className="text-[var(--tx)] font-medium">{oq.move_date || "TBD"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Status</div>
            <div className="text-[var(--tx)] font-medium capitalize">{oq.status}</div>
          </div>
        </div>
      </div>

      {/* Edit fields */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
        <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase mb-4">Update Details</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From Address</label>
            <input type="text" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>To Address</label>
            <input type="text" value={toAddress} onChange={(e) => setToAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>From Access</label>
            <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={inputClass}>
              <option value="">Select access...</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
              <option value="walk_up_2nd">Walk-Up (2nd)</option>
              <option value="walk_up_3rd">Walk-Up (3rd)</option>
              <option value="walk_up_4th_plus">Walk-Up (4th+)</option>
              <option value="long_carry">Long Carry</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>To Access</label>
            <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={inputClass}>
              <option value="">Select access...</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
              <option value="walk_up_2nd">Walk-Up (2nd)</option>
              <option value="walk_up_3rd">Walk-Up (3rd)</option>
              <option value="walk_up_4th_plus">Walk-Up (4th+)</option>
              <option value="long_carry">Long Carry</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Move Date</label>
            <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className={inputClass} />
          </div>
          {(serviceType === "local_move" || serviceType === "long_distance") && (
            <div>
              <label className={labelClass}>Move Size</label>
              <select value={moveSize} onChange={(e) => setMoveSize(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                <option value="studio">Studio</option>
                <option value="1br">1 Bedroom</option>
                <option value="2br">2 Bedroom</option>
                <option value="3br">3 Bedroom</option>
                <option value="4br">4 Bedroom</option>
                <option value="5br_plus">5+ Bedroom</option>
                <option value="partial">Partial Move</option>
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className={labelClass}>Reason for Update (shown in email &amp; HubSpot)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Client moved date, added items, changed address..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Generate button */}
      {!newQuoteResult && (
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : "Re-Generate Quote"}
        </button>
      )}

      {/* New quote result */}
      {newQuoteResult && (
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-5 mb-6 mt-6">
          <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase mb-3">New Quote Generated</div>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <div className="text-[11px] text-[var(--tx3)]">Quote ID</div>
              <div className="text-sm font-bold text-[var(--gold)]">{newQuoteId}</div>
            </div>
            {oldPrice && newPrice && (
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Price Change</div>
                <div className="text-sm font-medium text-[var(--tx)]">
                  <span className="line-through text-[var(--tx3)]">{formatCurrency(Number(oldPrice))}</span>
                  <span className="mx-2 text-[var(--tx3)]">→</span>
                  <span className="text-[var(--gold)] font-bold">{formatCurrency(Number(newPrice))}</span>
                </div>
              </div>
            )}
          </div>

          {newQuoteResult.tiers && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["essentials", "premier", "estate"].map((tier) => {
                const t = newQuoteResult.tiers[tier];
                if (!t) return null;
                return (
                  <div key={tier} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-center">
                    <div className="text-[10px] text-[var(--gold)] font-semibold uppercase">{t.label}</div>
                    <div className="text-lg font-bold text-[var(--tx)] mt-1">{formatCurrency(t.price)}</div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={handleSendUpdate}
            disabled={linking}
            className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {linking ? "Sending..." : "Send Updated Quote to Client"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 mt-4 text-[12px] border bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]">
          {error}
        </div>
      )}
    </div>
  );
}
