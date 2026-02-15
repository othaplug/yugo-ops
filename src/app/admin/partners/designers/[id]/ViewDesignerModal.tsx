"use client";

import { Icon } from "@/components/AppIcons";
import ModalOverlay from "../../../components/ModalOverlay";

interface DesignerInfo {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface ViewDesignerModalProps {
  open: boolean;
  onClose: () => void;
  designer: DesignerInfo;
}

export default function ViewDesignerModal({ open, onClose, designer }: ViewDesignerModalProps) {
  return (
    <ModalOverlay open={open} onClose={onClose} title="Designer Details" maxWidth="sm">
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Name</div>
            <div className="text-[14px] font-semibold text-[var(--tx)]">{designer.name}</div>
          </div>
          {designer.company && (
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Company</div>
              <div className="text-[13px] text-[var(--tx2)]">{designer.company}</div>
            </div>
          )}
          {designer.email && (
            <div className="flex items-center gap-2">
              <Icon name="mail" className="w-[14px] h-[14px] text-[var(--tx3)] shrink-0" />
              <a href={`mailto:${designer.email}`} className="text-[13px] text-[var(--gold)] hover:underline">
                {designer.email}
              </a>
            </div>
          )}
          {designer.phone && (
            <div className="flex items-center gap-2">
              <Icon name="phone" className="w-[14px] h-[14px] text-[var(--tx3)] shrink-0" />
              <a href={`tel:${designer.phone}`} className="text-[13px] text-[var(--tx2)] hover:text-[var(--gold)]">
                {designer.phone}
              </a>
            </div>
          )}
          {!designer.email && !designer.phone && (
            <div className="text-[12px] text-[var(--tx3)] py-2">No contact details on file</div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[var(--brd)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            Close
          </button>
        </div>
    </ModalOverlay>
  );
}
