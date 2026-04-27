"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { Warning, WarningCircle } from "@phosphor-icons/react";
import { Icon } from "@/components/AppIcons";

interface ToastContextType {
  /** Optional `durationMs` defaults by icon; pass a number to override (e.g. 4000 for in-app toasts). */
  toast: (message: string, icon?: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function toastDurationMs(icon: string) {
  if (icon === "x") return 5600;
  if (icon === "alertTriangle") return 5000;
  return 3800;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [iconKey, setIconKey] = useState("check");

  const toast = useCallback((msg: string, ic = "check", durationMs?: number) => {
    setMessage(msg);
    setIconKey(ic);
    setVisible(true);
    setTimeout(
      () => setVisible(false),
      durationMs !== undefined ? durationMs : toastDurationMs(ic),
    );
  }, []);

  const isError = iconKey === "x";
  const isWarning = iconKey === "alertTriangle";
  const isAttention = isError || isWarning;

  const toastPosition =
    "fixed left-4 right-4 md:left-auto md:right-4 bottom-[calc(var(--admin-mobile-nav-bar)+env(safe-area-inset-bottom,0px)+8px)] md:bottom-4 md:max-w-sm z-[100000] min-w-0";

  /** Portaled at document root, outside themed shells: do not use legacy `--tx` (often light-on-dark) on white surfaces. */
  const attentionShell =
    "rounded-xl px-4 py-3.5 flex items-start gap-3 text-[13px] font-semibold leading-snug text-zinc-900 bg-white border shadow-lg animate-toast-attention";
  const attentionIconOffset = "mt-0.5";

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {visible && (
        <div
          role={isAttention ? "alert" : "status"}
          aria-live={isAttention ? "assertive" : "polite"}
          className={
            isError
              ? `${toastPosition} yugo-toast-error ${attentionShell} border-red-200/90`
              : isWarning
                ? `${toastPosition} yugo-toast-warning ${attentionShell} border-amber-200/90`
                : `${toastPosition} yugo-glass rounded-lg px-3.5 py-2.5 shadow-lg flex items-center gap-2 text-[11px] font-medium animate-fade-up`
          }
        >
          {isError ? (
            <WarningCircle
              weight="bold"
              className={`w-5 h-5 shrink-0 text-red-600 ${attentionIconOffset}`}
              aria-hidden
            />
          ) : isWarning ? (
            <Warning
              weight="bold"
              className={`w-5 h-5 shrink-0 text-amber-700 ${attentionIconOffset}`}
              aria-hidden
            />
          ) : (
            <span className="text-[var(--grn)]">
              <Icon name={iconKey} className="w-[14px] h-[14px]" />
            </span>
          )}
          <span className="min-w-0">{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}