"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

const PROJECT_TYPES = [
  { value: "exhibition", label: "Exhibition" },
  { value: "delivery", label: "Delivery" },
  { value: "install", label: "Install / Deinstall" },
  { value: "storage_retrieval", label: "Storage retrieval" },
  { value: "art_fair", label: "Art fair" },
  { value: "other", label: "Other" },
] as const;

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "staging", label: "Staging" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
] as const;

export type GalleryProject = {
  id: string;
  name: string;
  gallery: string | null;
  gallery_org_id: string | null;
  details: string | null;
  status: string;
  address: string | null;
  project_type: string | null;
  white_glove: boolean;
  crating_required: boolean;
  climate_controlled: boolean;
  insurance_value: string | null;
  install_deinstall_notes: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
};

interface GalleryPartner {
  id: string;
  name: string | null;
  contact_name?: string | null;
  email?: string | null;
}

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: GalleryProject | null;
  galleryPartners: GalleryPartner[];
  onSaved: () => void;
}

export default function EditProjectModal({ open, onClose, project, galleryPartners, onSaved }: EditProjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [galleryOrgId, setGalleryOrgId] = useState("");
  const [details, setDetails] = useState("");
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [whiteGlove, setWhiteGlove] = useState(false);
  const [cratingRequired, setCratingRequired] = useState(false);
  const [climateControlled, setClimateControlled] = useState(false);
  const [estimate, setEstimate] = useState("");
  const [installDeinstallNotes, setInstallDeinstallNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!project) return;
    setName(project.name || "");
    setGalleryOrgId(project.gallery_org_id || "");
    setDetails(project.details || "");
    setAddress(project.address || "");
    setProjectType(project.project_type || "");
    setStatus(project.status || "new");
    setLocation(project.location || "");
    setWhiteGlove(project.white_glove ?? false);
    setCratingRequired(project.crating_required ?? false);
    setClimateControlled(project.climate_controlled ?? false);
    setEstimate(project.insurance_value || "");
    setInstallDeinstallNotes(project.install_deinstall_notes || "");
    setStartDate(project.start_date || "");
    setEndDate(project.end_date || "");
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id) return;
    if (!name.trim()) {
      toast("Project name is required", "x");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/gallery/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gallery_org_id: galleryOrgId || null,
          gallery: galleryOrgId ? galleryPartners.find((p) => p.id === galleryOrgId)?.name ?? null : null,
          details: details.trim() || null,
          address: address.trim() || null,
          project_type: projectType || null,
          status: status || null,
          location: location.trim() || null,
          white_glove: whiteGlove,
          crating_required: cratingRequired,
          climate_controlled: climateControlled,
          insurance_value: estimate.trim() || null,
          install_deinstall_notes: installDeinstallNotes.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");
      toast("Project updated", "check");
      onSaved();
      onClose();
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update project", "x");
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit project" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Project name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Feinstein: Convergence" required className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Project type</label>
          <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none">
            <option value="">Select type…</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Gallery partner</label>
          <select value={galleryOrgId} onChange={(e) => setGalleryOrgId(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none">
            <option value="">Select gallery…</option>
            {galleryPartners.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.email || p.id}</option>
            ))}
          </select>
        </div>
        <div>
          <AddressAutocomplete
            value={address}
            onRawChange={setAddress}
            onChange={(r) => setAddress(r.fullAddress)}
            placeholder="Delivery or exhibition address"
            label="Address / venue"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Location / venue name</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main Gallery, Vault" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
        </div>
        {(projectType === "exhibition" || projectType === "art_fair") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
        )}
        <div className="border-t border-[var(--brd)] pt-3">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Transport & handling</div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={whiteGlove} onChange={(e) => setWhiteGlove(e.target.checked)} className="rounded border-[var(--brd)]" /><span className="text-[12px] text-[var(--tx2)]">White-glove handling</span></label>
          <label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" checked={cratingRequired} onChange={(e) => setCratingRequired(e.target.checked)} className="rounded border-[var(--brd)]" /><span className="text-[12px] text-[var(--tx2)]">Crating required</span></label>
          <label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" checked={climateControlled} onChange={(e) => setClimateControlled(e.target.checked)} className="rounded border-[var(--brd)]" /><span className="text-[12px] text-[var(--tx2)]">Climate-controlled transport</span></label>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Estimate</label>
          <input type="text" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="e.g. $45K" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Install / deinstall notes</label>
          <input type="text" value={installDeinstallNotes} onChange={(e) => setInstallDeinstallNotes(e.target.value)} placeholder="e.g. Install only, Both" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Details</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Project details…" rows={3} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none resize-none" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50">{loading ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
