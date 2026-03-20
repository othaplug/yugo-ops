"use client";

import PartnerOnboardingWizard from "./PartnerOnboardingWizard";

interface InvitePartnerModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InvitePartnerModal({ open, onClose }: InvitePartnerModalProps) {
  return <PartnerOnboardingWizard open={open} onClose={onClose} />;
}
