"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

const PREFERRED_CONTACT_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" },
  { value: "any", label: "Any" },
];

const MOVE_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "office", label: "Office" },
  { value: "art", label: "Art" },
  { value: "other", label: "Other" },
];

interface AddReferralModalProps {
  open: boolean;
  onClose: () => void;
  realtors?: Realtor[];
}

export default function AddReferralModal({ open, onClose, realtors = [] }: AddReferralModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [address, setAddress] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [moveType, setMoveType] = useState("residential");

  const selectedRealtor = realtors.find((r) => r.id === agentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !selectedRealtor) {
      toast("Please select an agent", "x");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          agent_name: selectedRealtor.agent_name,
          brokerage: selectedRealtor.brokerage || "",
          agent_email: selectedRealtor.email || undefined,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
          property: address.trim(),
          preferred_contact: preferredContact,
          move_type: moveType,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create referral");

      toast("Referral created", "check");
      setAgentId("");
      setClientName("");
      setClientEmail("");
      setAddress("");
      setPreferredContact("email");
      setMoveType("residential");
      onClose();
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create referral", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Create Referral" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Agent Name *</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Select an agent</option>
            {realtors.map((r) => (
              <option key={r.id} value={r.id}>
                {r.agent_name}
                {r.brokerage ? ` (${r.brokerage})` : ""}
              </option>
            ))}
          </select>
          {realtors.length === 0 && (
            <p className="text-[10px] text-[var(--tx3)] mt-1">No realtors yet. Add one first from the Add Realtor button.</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Client Name</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Client Email</label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="client@example.com"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <AddressAutocomplete
            value={address}
            onRawChange={setAddress}
            onChange={(r) => setAddress(r.fullAddress)}
            placeholder="e.g. 123 Main St"
            label="Property address"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Preferred Method of Communication</label>
          <select
            value={preferredContact}
            onChange={(e) => setPreferredContact(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            {PREFERRED_CONTACT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Type of Move</label>
          <select
            value={moveType}
            onChange={(e) => setMoveType(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            {MOVE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || realtors.length === 0}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Referral"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
