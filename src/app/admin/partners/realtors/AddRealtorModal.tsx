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
          <label className="admin-premium-label">Agent Name *</label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. Jane Smith"
            required
            className="admin-premium-input w-full"
          />
        </div>
        <div>
          <label className="admin-premium-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@brokerage.com"
            className="admin-premium-input w-full"
          />
        </div>
        <div>
          <label className="admin-premium-label">Brokerage</label>
          <input
            type="text"
            value={brokerage}
            onChange={(e) => setBrokerage(e.target.value)}
            placeholder="e.g. Royal LePage"
            className="admin-premium-input w-full"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn-primary flex-1"
          >
            {loading ? "Creating…" : "Add Realtor"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
