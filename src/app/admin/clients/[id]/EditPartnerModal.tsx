"use client";

import { useState, useEffect } from "react";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";
import { PARTNER_SEGMENT_GROUPS } from "@/lib/partner-type";

interface EditPartnerModalProps {
  open: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    type: string;
    contact_name?: string;
    email: string;
    phone?: string;
  };
  onSaved?: () => void;
}

export default function EditPartnerModal({
  open,
  onClose,
  client,
  onSaved,
}: EditPartnerModalProps) {
  const isClient = client.type === "b2c";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(client.name);
  const [type, setType] = useState(client.type);
  const [contactName, setContactName] = useState(client.contact_name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(
    client.phone ? formatPhone(client.phone) : "",
  );
  const phoneInput = usePhoneInput(phone, setPhone);

  useEffect(() => {
    if (open) {
      setName(client.name);
      setType(client.type);
      setContactName(client.contact_name || "");
      setEmail(client.email || "");
      setPhone(client.phone ? formatPhone(client.phone) : "");
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast(
        isClient
          ? "Name and email are required"
          : "Company name and email are required",
        "x",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: isClient ? "b2c" : type,
          contact_name: isClient ? name.trim() : contactName.trim(),
          email: email.trim(),
          phone: normalizePhone(phone).trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast(isClient ? "Client updated" : "Partner updated", "check");
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={isClient ? "Edit Client" : "Edit Partner"}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="admin-premium-label">
            {isClient ? "Name *" : "Company Name *"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isClient ? "e.g. John Smith" : "e.g. Roche Bobois"}
            required
            className="admin-premium-input w-full"
          />
        </div>
        {!isClient && (
          <div>
            <label className="admin-premium-label">Partner Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="admin-premium-input w-full"
            >
              {PARTNER_SEGMENT_GROUPS.flatMap((seg) =>
                seg.groups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.verticals.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                )),
              )}
            </select>
          </div>
        )}
        {!isClient && (
          <div>
            <label className="admin-premium-label">Contact Name</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Marie Dubois"
              className="admin-premium-input w-full"
            />
          </div>
        )}
        <div>
          <label className="admin-premium-label">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            required
            className="admin-premium-input w-full"
          />
        </div>
        <div>
          <label className="admin-premium-label">Phone</label>
          <input
            ref={phoneInput.ref}
            type="tel"
            value={phone}
            onChange={phoneInput.onChange}
            placeholder={PHONE_PLACEHOLDER}
            className="admin-premium-input w-full"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn-primary flex-1"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
