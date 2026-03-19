"use client";

import { useState, useCallback, ReactNode } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

/**
 * Drop-in replacement for window.confirm() that renders a branded
 * ConfirmDialog instead of the browser native prompt.
 *
 * Usage:
 *   const { confirmEl, confirm } = useConfirm();
 *   // in JSX: {confirmEl}
 *   // to trigger: const ok = await confirm({ title: "Delete this?", variant: "danger" });
 */
export function useConfirm() {
  const [pending, setPending] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    pending?.resolve(true);
    setPending(null);
  }, [pending]);

  const handleCancel = useCallback(() => {
    pending?.resolve(false);
    setPending(null);
  }, [pending]);

  const confirmEl: ReactNode = pending ? (
    <ConfirmDialog
      open={true}
      title={pending.opts.title}
      message={pending.opts.message}
      confirmLabel={pending.opts.confirmLabel}
      cancelLabel={pending.opts.cancelLabel}
      variant={pending.opts.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, confirmEl };
}
