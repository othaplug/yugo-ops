"use client";

import { formatPhone, normalizePhone } from "@/lib/phone";
import ModalOverlay from "./ModalOverlay";
import { Icon } from "@/components/AppIcons";

interface ContactDetails {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface ContactDetailsModalProps {
  open: boolean;
  onClose: () => void;
  contact: ContactDetails;
}

export default function ContactDetailsModal({ open, onClose, contact }: ContactDetailsModalProps) {
  return (
    <ModalOverlay open={open} onClose={onClose} title="Contact Details" maxWidth="sm">
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Name</div>
          <div className="text-[14px] font-semibold text-[var(--tx)]">{contact.name}</div>
        </div>
        {contact.company && (
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Company</div>
            <div className="text-[13px] text-[var(--tx2)]">{contact.company}</div>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Icon name="mail" className="w-[14px] h-[14px] text-[var(--tx3)] shrink-0" />
            <a href={`mailto:${contact.email}`} className="text-[13px] text-[var(--gold)] hover:underline">
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Icon name="phone" className="w-[14px] h-[14px] text-[var(--tx3)] shrink-0" />
            <a href={`tel:${normalizePhone(contact.phone)}`} className="text-[13px] text-[var(--tx2)] hover:text-[var(--gold)]">
              {formatPhone(contact.phone)}
            </a>
          </div>
        )}
        {!contact.email && !contact.phone && (
          <div className="text-[12px] text-[var(--tx3)] py-2">No contact details on file</div>
        )}
      </div>
    </ModalOverlay>
  );
}
