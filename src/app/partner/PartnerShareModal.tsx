"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";

interface Props {
  delivery: {
    id: string;
    delivery_number: string;
    customer_name: string | null;
    delivery_address: string | null;
  };
  onClose: () => void;
  onSent?: () => void;
}

export default function PartnerShareModal({ delivery, onClose, onSent }: Props) {
  const [method, setMethod] = useState<"email" | "sms">("email");
  const [recipient, setRecipient] = useState("");
  const phoneInput = usePhoneInput(recipient, setRecipient);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const handleSend = async () => {
    if (!recipient.trim()) { setError("Enter a recipient"); return; }
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/partner/share-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_id: delivery.id,
          method,
          recipient: method === "sms" && recipient.trim() ? normalizePhone(recipient) : recipient.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSent(true);
      onSent?.();
      setTimeout(() => onClose(), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 modal-overlay" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-[420px] modal-card animate-slide-up sm:animate-none" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-[var(--tx)] font-hero">Share Tracking Link</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg2)] transition-colors text-[var(--tx3)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="bg-[var(--bg2)] rounded-xl p-3 mb-4">
            <div className="text-[13px] font-semibold text-[var(--tx)]">{delivery.customer_name || delivery.delivery_number}</div>
            <div className="text-[11px] text-[var(--tx3)] mt-0.5">{delivery.delivery_address || "—"}</div>
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[12px] text-red-600 dark:text-red-400">{error}</div>
          )}

          {sent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D9F5A" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-[14px] font-semibold text-[var(--tx)]">Tracking link sent!</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMethod("email")}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    method === "email" ? "border-[#C9A962] bg-[#C9A962]/5 text-[#C9A962]" : "border-[var(--brd)] text-[var(--tx3)]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Email
                </button>
                <button
                  onClick={() => setMethod("sms")}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    method === "sms" ? "border-[#C9A962] bg-[#C9A962]/5 text-[#C9A962]" : "border-[var(--brd)] text-[var(--tx3)]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  SMS
                </button>
              </div>

              <input
                ref={method === "sms" ? phoneInput.ref : undefined}
                value={recipient}
                onChange={method === "sms" ? phoneInput.onChange : (e) => setRecipient(e.target.value)}
                placeholder={method === "email" ? "Email address" : PHONE_PLACEHOLDER}
                type={method === "email" ? "email" : "tel"}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#C9A962] focus:outline-none transition-colors mb-4 bg-[var(--card)]"
              />

              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full px-4 py-2.5 rounded-lg text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send tracking link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
