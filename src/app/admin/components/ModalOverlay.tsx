"use client"

import type { ReactNode } from "react"
import GlobalModal from "@/components/ui/Modal"

interface ModalOverlayProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"
  noHeader?: boolean
  noPadding?: boolean
  titleClassName?: string
}

/** Wrapper around GlobalModal for backward compatibility. All modals render via Portal to document.body. */
export default function ModalOverlay({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
  noHeader,
  noPadding,
  titleClassName,
}: ModalOverlayProps) {
  return (
    <GlobalModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      noHeader={noHeader}
      noPadding={noPadding}
      titleClassName={titleClassName}
    >
      {children}
    </GlobalModal>
  )
}
