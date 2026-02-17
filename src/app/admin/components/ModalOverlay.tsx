"use client";

import GlobalModal from "@/components/ui/Modal";

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

/** Wrapper around GlobalModal for backward compatibility. All modals render via Portal to document.body. */
export default function ModalOverlay({ open, onClose, title, children, maxWidth = "md" }: ModalOverlayProps) {
  return (
    <GlobalModal open={open} onClose={onClose} title={title} maxWidth={maxWidth}>
      {children}
    </GlobalModal>
  );
}
