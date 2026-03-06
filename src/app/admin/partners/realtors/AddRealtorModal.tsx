"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";

interface AddRealtorModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddRealtorModal({ open, onClose }: AddRealtorModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [email, setEmail] = useState("");
  const [brokerage, setBrokerage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) {
      toast("Agent name is required", "x");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/realtors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: agentName.trim(),
          email: email.trim() || undefined,
          brokerage: brokerage.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create realtor");

      toast("Realtor created", "check");
      setAgentName("");
      setEmail("");
      setBrokerage("");
      onClose();
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create realtor", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Add Realtor" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Agent Name *</label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. Jane Smith"
            required
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@brokerage.com"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Brokerage</label>
          <input
            type="text"
            value={brokerage}
            onChange={(e) => setBrokerage(e.target.value)}
            placeholder="e.g. Royal LePage"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
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
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {loading ? "Creating…" : "Add Realtor"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
