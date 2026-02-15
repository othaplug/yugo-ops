"use client";

import { Icon } from "@/components/AppIcons";

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

export default function ModalOverlay({ open, onClose, title, children, maxWidth = "md" }: ModalOverlayProps) {
  if (!open) return null;

  const maxW = maxWidth === "sm" ? "max-w-sm" : maxWidth === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxW} max-h-[90vh] flex flex-col bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl animate-fade-up overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between shrink-0">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)] transition-colors"
            aria-label="Close"
          >
            <Icon name="x" className="w-[16px] h-[16px]" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
