"use client";

import GlobalModal from "@/components/ui/Modal";

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  noHeader?: boolean;
  noPadding?: boolean;
}

/** Wrapper around GlobalModal for backward compatibility. All modals render via Portal to document.body. */
export default function ModalOverlay({ open, onClose, title, children, maxWidth = "md", noHeader, noPadding }: ModalOverlayProps) {
  return (
    <GlobalModal open={open} onClose={onClose} title={title} maxWidth={maxWidth} noHeader={noHeader} noPadding={noPadding}>
      {children}
    </GlobalModal>
  );
}
