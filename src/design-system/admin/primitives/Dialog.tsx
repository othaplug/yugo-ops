"use client";

import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { cn } from "../lib/cn";
import { X } from "../icons";
import { useYu3PortalContainer } from "../layout/Yu3PortalContext";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogPortal = D.Portal;
export const DialogClose = D.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof D.Overlay>,
  React.ComponentPropsWithoutRef<typeof D.Overlay>
>(({ className, ...rest }, ref) => (
  <D.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[var(--yu3-z-modal-scrim)] bg-[var(--yu3-bg-overlay)] pointer-events-auto backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className,
    )}
    {...rest}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof D.Content>,
  React.ComponentPropsWithoutRef<typeof D.Content> & {
    size?: "sm" | "md" | "lg" | "xl";
  }
>(({ className, children, size = "md", ...rest }, ref) => {
  const maxW =
    size === "sm"
      ? "max-w-[400px]"
      : size === "lg"
        ? "max-w-[720px]"
        : size === "xl"
          ? "max-w-[960px]"
          : "max-w-[520px]";
  const portalContainer = useYu3PortalContainer();
  return (
    <D.Portal container={portalContainer ?? undefined}>
      <DialogOverlay />
      <D.Content
        ref={ref}
        className={cn(
          "fixed z-[var(--yu3-z-modal)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto",
          "w-[calc(100vw-2rem)]",
          maxW,
          "max-h-[calc(100vh-4rem)] overflow-auto",
          "bg-[var(--yu3-bg-surface,#ffffff)] text-[var(--yu3-ink,#24201d)] border border-[var(--yu3-line,#d4cdbb)]",
          "rounded-[var(--yu3-r-xl)] shadow-[var(--yu3-shadow-lg)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...rest}
      >
        {children}
        <D.Close
          className="absolute right-3 top-3 inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
          aria-label="Close"
        >
          <X size={16} weight="regular" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
});
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "px-5 pt-5 pb-3 border-b border-[var(--yu3-line-subtle)]",
      className,
    )}
    {...rest}
  />
);
DialogHeader.displayName = "DialogHeader";

export const DialogBody = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-4", className)} {...rest} />
);
DialogBody.displayName = "DialogBody";

export const DialogFooter = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "px-5 py-3 border-t border-[var(--yu3-line-subtle)] flex items-center justify-end gap-2",
      className,
    )}
    {...rest}
  />
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof D.Title>,
  React.ComponentPropsWithoutRef<typeof D.Title>
>(({ className, ...rest }, ref) => (
  <D.Title
    ref={ref}
    className={cn(
      "text-[var(--yu3-ink-strong)] text-[16px] font-semibold",
      className,
    )}
    {...rest}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof D.Description>,
  React.ComponentPropsWithoutRef<typeof D.Description>
>(({ className, ...rest }, ref) => (
  <D.Description
    ref={ref}
    className={cn("text-[13px] text-[var(--yu3-ink-muted)] mt-1", className)}
    {...rest}
  />
));
DialogDescription.displayName = "DialogDescription";
