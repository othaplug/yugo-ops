"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, Envelope, Chat } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";
import { partnerModalPanelClass } from "@/components/partner/PartnerChrome";

type DeliveryTarget = {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  delivery_address: string | null;
};

type MoveTarget = {
  id: string;
  move_code: string | null;
  client_name: string | null;
  to_address: string | null;
};

interface Props {
  delivery?: DeliveryTarget;
  move?: MoveTarget;
  onClose: () => void;
  onSent?: () => void;
}

export default function PartnerShareModal({ delivery, move, onClose, onSent }: Props) {
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
    if (!recipient.trim()) {
      setError("Enter a recipient");
      return;
    }
    if (!delivery && !move) {
      setError("Nothing to share");
      return;
    }
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/partner/share-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(delivery ? { delivery_id: delivery.id } : {}),
          ...(move ? { move_id: move.id } : {}),
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

  const titleLine = delivery
    ? delivery.customer_name || delivery.delivery_number
    : move?.client_name || move?.move_code || "Move";
  const addrLine = delivery ? delivery.delivery_address || "-" : move?.to_address || "-";

  const modalContent = (
    <ModalDialogFrame
      zClassName="z-[99999]"
      backdropClassName="bg-black/45"
      onBackdropClick={onClose}
      panelClassName={`${partnerModalPanelClass} w-full sm:max-w-[420px] sheet-card sm:modal-card`}
      panelStyle={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-hero text-[20px] font-normal text-[#5C1A33]">Share tracking link</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-sm hover:bg-[#2C3E2D]/[0.04] transition-colors text-[#5A6B5E]"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="border border-[#2C3E2D]/10 rounded-sm p-3 mb-4 bg-[#2C3E2D]/[0.02]">
          <div className="text-[13px] font-semibold text-[var(--tx)]">{titleLine}</div>
          <div className="text-[11px] text-[var(--tx3)] mt-0.5">{addrLine}</div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[12px] text-red-600">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Check size={24} color="#2D9F5A" weight="bold" />
            </div>
            <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">Tracking link sent!</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMethod("email")}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  method === "email"
                    ? "border-[#2C3E2D] bg-[#2C3E2D]/5 text-[var(--tx)]"
                    : "border-[var(--brd)] text-[var(--tx3)]"
                }`}
              >
                <Envelope size={14} className="inline mr-1.5" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setMethod("sms")}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  method === "sms"
                    ? "border-[#2C3E2D] bg-[#2C3E2D]/5 text-[var(--tx)]"
                    : "border-[var(--brd)] text-[var(--tx3)]"
                }`}
              >
                <Chat size={14} className="inline mr-1.5" />
                SMS
              </button>
            </div>

            <input
              ref={method === "sms" ? phoneInput.ref : undefined}
              value={recipient}
              onChange={method === "sms" ? phoneInput.onChange : (e) => setRecipient(e.target.value)}
              placeholder={method === "email" ? "Email address" : PHONE_PLACEHOLDER}
              type={method === "email" ? "email" : "tel"}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#2C3E2D] focus:outline-none transition-colors mb-4 bg-[var(--card)]"
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="w-full px-4 py-2.5 rounded-sm text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send tracking link"}
            </button>
          </>
        )}
      </div>
    </ModalDialogFrame>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
