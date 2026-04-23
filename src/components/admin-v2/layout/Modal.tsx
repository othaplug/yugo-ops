"use client"

import * as React from "react"
import * as RadixDialog from "@radix-ui/react-dialog"
import { Icon } from "../primitives/Icon"
import { cn } from "../lib/cn"

export const Modal = RadixDialog.Root
export const ModalTrigger = RadixDialog.Trigger
export const ModalClose = RadixDialog.Close

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
} as const

export type ModalSize = keyof typeof sizeClass

export const ModalContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
    size?: ModalSize
  }
>(({ className, size = "md", children, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-[4px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      )}
    />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
        "rounded-xl border border-line bg-surface shadow-lg outline-none",
        "p-6",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "duration-200",
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
      <RadixDialog.Close asChild>
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
          aria-label="Close"
        >
          <Icon name="close" size="md" />
        </button>
      </RadixDialog.Close>
    </RadixDialog.Content>
  </RadixDialog.Portal>
))
ModalContent.displayName = "ModalContent"

export const ModalHeader = ({
  title,
  description,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) => (
  <div className={cn("mb-4 pr-10", className)}>
    <RadixDialog.Title className="heading-md text-fg">{title}</RadixDialog.Title>
    {description ? (
      <RadixDialog.Description className="mt-1 body-sm text-fg-muted">
        {description}
      </RadixDialog.Description>
    ) : null}
  </div>
)

export const ModalFooter = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => (
  <div
    className={cn(
      "mt-6 flex items-center justify-end gap-2",
      className,
    )}
  >
    {children}
  </div>
)

export const ModalTitle = RadixDialog.Title
export const ModalDescription = RadixDialog.Description
