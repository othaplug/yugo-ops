"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ModalOverlay from "../../components/ModalOverlay";

interface EditMoveDetailsModalProps {
  open: boolean;
  onClose: () => void;
  moveId: string;
  initial: {
    from_address?: string | null;
    to_address?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    arrival_window?: string | null;
    access_notes?: string | null;
  };
  onSaved?: (updates: Record<string, unknown>) => void;
}

export default function EditMoveDetailsModal({ open, onClose, moveId, initial, onSaved }: EditMoveDetailsModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [fromAddress, setFromAddress] = useState(initial.from_address || "");
  const [toAddress, setToAddress] = useState(initial.to_address || "");
  const toDateInput = (d: string | null | undefined) => {
    if (!d) return "";
    const p = new Date(d);
    return isNaN(p.getTime()) ? "" : p.toISOString().slice(0, 10);
  };
  const [scheduledDate, setScheduledDate] = useState(() => toDateInput(initial.scheduled_date));
  const [scheduledTime, setScheduledTime] = useState(initial.scheduled_time || "");
  const [arrivalWindow, setArrivalWindow] = useState(initial.arrival_window || "");
  const [accessNotes, setAccessNotes] = useState(initial.access_notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFromAddress(initial.from_address || "");
      setToAddress(initial.to_address || "");
      setScheduledDate(toDateInput(initial.scheduled_date));
      setScheduledTime(initial.scheduled_time || "");
      setArrivalWindow(initial.arrival_window || "");
      setAccessNotes(initial.access_notes || "");
    }
  }, [open, initial.from_address, initial.to_address, initial.scheduled_date, initial.scheduled_time, initial.arrival_window, initial.access_notes]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const updated_at = new Date().toISOString();
    const { data } = await supabase
      .from("moves")
      .update({
        from_address: fromAddress.trim() || null,
        to_address: toAddress.trim() || null,
        delivery_address: toAddress.trim() || null,
        scheduled_date: scheduledDate.trim() || null,
        scheduled_time: scheduledTime.trim() || null,
        arrival_window: arrivalWindow.trim() || null,
        access_notes: accessNotes.trim() || null,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    setSaving(false);
    onClose();
    if (data) onSaved?.(data);
    router.refresh();
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit move details" maxWidth="md">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">From address</label>
          <input
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="Origin address"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">To address</label>
          <input
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="Destination address"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Arrival window</label>
          <input
            value={arrivalWindow}
            onChange={(e) => setArrivalWindow(e.target.value)}
            placeholder="e.g. 8:00 to 10:00 AM"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Property access & conditions</label>
          <textarea
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            placeholder="Elevator reserved, loading dock, stairs, parking, access notes..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none resize-none"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
