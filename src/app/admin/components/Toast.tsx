"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface ToastContextType {
  toast: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [icon, setIcon] = useState("✅");

  const toast = useCallback((msg: string, ic = "✅") => {
    setMessage(msg);
    setIcon(ic);
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {visible && (
        <div className="fixed bottom-4 right-4 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3.5 py-2.5 shadow-lg flex items-center gap-1.5 z-[200] text-[11px] font-medium animate-fade-up">
          <span className="text-[13px]">{icon}</span>
          <span>{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}