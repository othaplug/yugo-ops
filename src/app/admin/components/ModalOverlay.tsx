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
    <div className="fixed inset-0 z-[100] flex items-center justify-end sm:justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxW} bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl animate-fade-up ml-auto sm:ml-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)] transition-colors"
            aria-label="Close"
          >
            <Icon name="x" className="w-[16px] h-[16px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
