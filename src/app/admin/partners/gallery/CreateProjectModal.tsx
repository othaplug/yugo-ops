"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [gallery, setGallery] = useState("");
  const [details, setDetails] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Project name is required", "x");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/gallery/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), gallery: gallery.trim() || null, details: details.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      toast("Project created", "check");
      setName("");
      setGallery("");
      setDetails("");
      onClose();
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create project", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Create Project" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Feinstein: Convergence"
            required
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Gallery</label>
          <input
            type="text"
            value={gallery}
            onChange={(e) => setGallery(e.target.value)}
            placeholder="e.g. Bau-Xi"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Details</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Project details..."
            rows={3}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none resize-none"
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
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Project"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
