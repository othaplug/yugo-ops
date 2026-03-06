"use client";

import { useState, useEffect } from "react";
import type { Project } from "../projectsData";
import { formatPhone, normalizePhone } from "@/lib/phone";
import ModalOverlay from "../../../components/ModalOverlay";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onSaved?: (updated: Partial<Project>) => void;
}

export default function EditProjectModal({ open, onClose, project, onSaved }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address);
  const [installDate, setInstallDate] = useState(project.installDate);
  const [budget, setBudget] = useState(project.budget || "");
  const [notes, setNotes] = useState(project.notes || "");
  const [designer, setDesigner] = useState(project.designer);
  const [designerCompany, setDesignerCompany] = useState(project.designerCompany || "");
  const [designerEmail, setDesignerEmail] = useState(project.designerEmail || "");
  const [designerPhone, setDesignerPhone] = useState(project.designerPhone ? formatPhone(project.designerPhone) : "");

  useEffect(() => {
    if (open) {
      setName(project.name);
      setAddress(project.address);
      setInstallDate(project.installDate);
      setBudget(project.budget || "");
      setNotes(project.notes || "");
      setDesigner(project.designer);
      setDesignerCompany(project.designerCompany || "");
      setDesignerEmail(project.designerEmail || "");
      setDesignerPhone(project.designerPhone ? formatPhone(project.designerPhone) : "");
    }
  }, [open, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Partial<Project> = {
      name: name.trim(),
      address: address.trim(),
      installDate: installDate.trim(),
      budget: budget.trim() || undefined,
      notes: notes.trim() || undefined,
      designer: designer.trim(),
      designerCompany: designerCompany.trim() || undefined,
      designerEmail: designerEmail.trim() || undefined,
      designerPhone: normalizePhone(designerPhone).trim() || undefined,
    };
    onSaved?.(updated);
    onClose();
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit project" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Project name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            required
          />
        </div>
        <div>
          <AddressAutocomplete
            value={address}
            onRawChange={setAddress}
            onChange={(r) => setAddress(r.fullAddress)}
            placeholder="e.g. 42 Crescent Rd, Toronto"
            label="Address"
            className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Install date</label>
            <input
              type="text"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
              placeholder="e.g. Feb 15"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Budget</label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. $285K"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Designer</label>
          <input
            type="text"
            value={designer}
            onChange={(e) => setDesigner(e.target.value)}
            className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Designer company</label>
          <input
            type="text"
            value={designerCompany}
            onChange={(e) => setDesignerCompany(e.target.value)}
            className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Designer email</label>
            <input
              type="email"
              value={designerEmail}
              onChange={(e) => setDesignerEmail(e.target.value)}
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Designer phone</label>
            <input
              type="tel"
              value={designerPhone}
              onChange={(e) => setDesignerPhone(e.target.value)}
              onBlur={() => setDesignerPhone(formatPhone(designerPhone))}
              placeholder="(123) 456-7890"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none resize-none"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--bg)]/50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
          >
            Save
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
