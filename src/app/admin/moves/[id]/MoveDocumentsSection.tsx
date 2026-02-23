"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Link as LinkIcon, FileText } from "lucide-react";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatCurrency } from "@/lib/format-currency";

type Doc = { id: string; type: string; title: string; view_url?: string | null; storage_path?: string; external_url?: string | null };
type Invoice = { id: string; invoice_number: string; client_name: string; amount: number; move_id: string | null };

type DocItem = Doc & { source: "move" | "client" };

const DOC_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "estimate", label: "Estimate" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

export default function MoveDocumentsSection({ moveId }: { moveId: string }) {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [clientDocuments, setClientDocuments] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [linkedInvoices, setLinkedInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<"link" | "upload" | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState("contract");
  const [linkInvoiceId, setLinkInvoiceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DocItem | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/moves/${moveId}/documents`).then((r) => r.json()),
      fetch(`/api/admin/client-documents?move_id=${moveId}`).then((r) => r.json()),
      fetch(`/api/admin/invoices`).then((r) => r.json()),
    ]).then(([docRes, clientRes, invRes]) => {
      setDocuments(docRes.documents ?? []);
      setClientDocuments(clientRes.documents ?? []);
      setInvoices(invRes.invoices ?? []);
      setLinkedInvoices((invRes.invoices ?? []).filter((i: Invoice) => i.move_id === moveId));
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [moveId]);

  const allDocuments: DocItem[] = [
    ...documents.map((d) => ({ ...d, source: "move" as const })),
    ...clientDocuments.map((d) => ({ ...d, source: "client" as const })),
  ].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  const handleAddLink = () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setAdding(null);
    fetch(`/api/admin/moves/${moveId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: linkTitle.trim(), type: linkType, external_url: linkUrl.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLinkTitle("");
        setLinkUrl("");
        fetchData();
      });
  };

  const handleLinkInvoice = () => {
    if (!linkInvoiceId) return;
    setAdding(null);
    fetch(`/api/admin/invoices/${linkInvoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move_id: moveId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLinkInvoiceId("");
        fetchData();
      });
  };

  const handleUnlinkInvoice = (invoiceId: string) => {
    setUnlinkConfirm(invoices.find((i) => i.id === invoiceId) ?? null);
  };

  const confirmUnlink = async () => {
    if (!unlinkConfirm) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/invoices/${unlinkConfirm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move_id: null }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast(data.error || "Failed to unlink", "x");
        return;
      }
      setUnlinkConfirm(null);
      fetchData();
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
    formData.append("type", "other");
    fetch(`/api/admin/moves/${moveId}/documents`, { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        fetchData();
      })
      .finally(() => {
        setUploading(false);
        e.target.value = "";
      });
  };

  const handleDeleteDoc = (item: DocItem) => {
    setDeleteConfirm(item);
  };

  const confirmDeleteDoc = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const url = deleteConfirm.source === "move"
        ? `/api/admin/moves/${moveId}/documents/${deleteConfirm.id}`
        : `/api/admin/client-documents/${deleteConfirm.id}`;
      const r = await fetch(url, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast(data.error || "Failed to remove", "x");
        return;
      }
      setDeleteConfirm(null);
      fetchData();
    } finally {
      setDeleting(false);
    }
  };

  const unlinkedInvoices = invoices.filter((i) => i.move_id !== moveId);

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Documents & Invoices
      </h3>
      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : (
        <>
          <div className="mb-3">
            {linkedInvoices.length > 0 ? (
              <ul className="space-y-1">
                {linkedInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[var(--tx)]">
                      {inv.invoice_number} — {inv.client_name} ({formatCurrency(inv.amount)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnlinkInvoice(inv.id)}
                      className="text-[var(--tx3)] hover:text-[var(--red)]"
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {adding === "link" && unlinkedInvoices.length > 0 ? (
              <div className="flex gap-2 mt-2">
                <select
                  value={linkInvoiceId}
                  onChange={(e) => setLinkInvoiceId(e.target.value)}
                  className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] flex-1 focus:border-[var(--gold)] outline-none"
                >
                  <option value="">Select invoice…</option>
                  {unlinkedInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} — {i.client_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkInvoice}
                  disabled={!linkInvoiceId}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
                >
                  Link
                </button>
                <button type="button" onClick={() => setAdding(null)} className="text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              unlinkedInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAdding("link")}
                  className="text-[10px] font-semibold text-[var(--gold)] hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="w-[10px] h-[10px]" /> Link invoice to move
                </button>
              )
            )}
          </div>

          <div>
            {allDocuments.length > 0 ? (
              <ul className="space-y-1 mb-3">
                {allDocuments.map((d) => (
                  <li key={d.source === "move" ? d.id : `client-${d.id}`} className="flex items-center justify-between gap-2 py-0.5">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <FileText className="w-[11px] h-[11px] text-[var(--tx3)] shrink-0" />
                      <span className="text-[11px] text-[var(--tx)] truncate">{d.title}</span>
                      <span className="ml-1 text-[9px] text-[var(--tx3)] capitalize shrink-0">({d.type})</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {d.view_url && (
                        <a
                          href={d.view_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                        >
                          View
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d)}
                        className="p-1 rounded-md text-[var(--tx3)] hover:bg-[var(--rdim)] hover:text-[var(--red)] transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-[11px] h-[11px]" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[var(--tx3)] mb-2">No documents yet</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] cursor-pointer transition-colors disabled:opacity-50">
                <Plus className="w-[11px] h-[11px]" />
                {uploading ? "Uploading…" : "Add document (upload PDF)"}
                <input type="file" accept=".pdf,image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
              </label>
              {adding === "link" ? (
                <div className="flex flex-wrap gap-2 items-end">
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Title"
                    className="w-32 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-40 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  />
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value)}
                    className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    disabled={!linkTitle.trim() || !linkUrl.trim()}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
                  >
                    Add link
                  </button>
                  <button type="button" onClick={() => setAdding(null)} className="text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding("link")}
                  className="text-[10px] font-semibold text-[var(--gold)] hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="w-[10px] h-[10px]" /> Add link
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete document confirmation */}
      {deleteConfirm && (
        <ModalOverlay open onClose={() => !deleting && setDeleteConfirm(null)} title="Remove document?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">
              Are you sure you want to remove &quot;{deleteConfirm.title}&quot;? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDoc}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Unlink invoice confirmation */}
      {unlinkConfirm && (
        <ModalOverlay open onClose={() => !deleting && setUnlinkConfirm(null)} title="Unlink invoice?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">
              Are you sure you want to unlink {unlinkConfirm.invoice_number} from this move?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUnlinkConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUnlink}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
              >
                {deleting ? "Unlinking…" : "Unlink"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
