"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Upload, FileText, Image, X, CaretDown as ChevronDown, CaretRight as ChevronRight, ArrowSquareOut as ExternalLink, ArrowsClockwise as RefreshCw, Trash as Trash2, Warning } from "@phosphor-icons/react";


import { useToast } from "../../components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileEntry = {
  id: string;
  url: string;
  name: string;
  type: "image" | "pdf" | "other";
  badge: "pod" | "photo" | "doc" | "upload";
  date: string;
  caption?: string | null;
  source?: string;
  /** When true, show delete control and call onDelete(id) when requested */
  deletable?: boolean;
};

type SignOffData = {
  signed_by?: string;
  signed_at?: string;
  satisfaction_rating?: number | null;
  nps_score?: number | null;
  feedback_note?: string | null;
  escalation_triggered?: boolean;
  escalation_reason?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShort(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isImage(url: string, type?: string) {
  if (type && type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic)(\?|$)/i.test(url);
}

function isPdf(url: string, type?: string) {
  if (type && type === "application/pdf") return true;
  return /\.pdf(\?|$)/i.test(url);
}

const BADGE_STYLES: Record<string, string> = {
  pod:    "text-[var(--tx)] dark:text-[#A8C4A9]",
  photo:  "text-[#1B4332] dark:text-emerald-300",
  doc:    "text-blue-700 dark:text-sky-300",
  upload: "text-[var(--tx2)]",
};

const BADGE_LABELS: Record<string, string> = {
  pod: "PoD", photo: "Photo", doc: "Doc", upload: "Uploaded",
};

// ─── Collapsible group ────────────────────────────────────────────────────────

function FileGroup({
  label,
  borderColor,
  files,
  empty,
  defaultOpen = true,
  extra,
  onDeleteFile,
}: {
  label: string;
  borderColor: string;
  files: FileEntry[];
  empty?: string;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
  onDeleteFile?: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (files.length === 0 && !extra) return null;

  return (
    <div className={`border-l-2 pl-3 ${borderColor}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        {open ? (
          <ChevronDown className="w-[13px] h-[13px] text-[var(--tx3)] shrink-0" />
        ) : (
          <ChevronRight className="w-[13px] h-[13px] text-[var(--tx3)] shrink-0" />
        )}
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">
          {label}
        </span>
        <span className="text-[9px] text-[var(--tx3)] ml-1">({files.length})</span>
      </button>

      {open && (
        <>
          {extra}
          {files.length === 0 && empty && (
            <p className="text-[11px] text-[var(--tx3)] ml-4">{empty}</p>
          )}
          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {files.map((f) => (
                <div key={f.id} className="relative group">
                  {f.type === "image" ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(f.url)}
                      className="block w-full aspect-square rounded-lg overflow-hidden border border-[var(--brd)]/60 bg-[var(--bg)] hover:border-[var(--gold)]/50 transition-colors"
                    >
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center aspect-square rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)] hover:border-[var(--gold)]/50 transition-colors gap-1"
                    >
                      <FileText className="w-3 h-3 text-[var(--tx3)]" />
                      <ExternalLink className="w-2 h-2 text-[var(--tx3)]" />
                    </a>
                  )}
                  {f.deletable && onDeleteFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onDeleteFile(f.id);
                      }}
                      className="absolute top-1 right-1 p-1 rounded-md bg-[var(--card)] border border-[var(--brd)]/60 text-[var(--tx3)] hover:text-red-600 hover:border-red-200 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {/* Badge + date tooltip */}
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.04em] ${BADGE_STYLES[f.badge]}`}>
                        {BADGE_LABELS[f.badge]}
                      </span>
                    </div>
                    <p className="text-[9px] text-[var(--tx3)] truncate" title={f.name}>
                      {f.caption || f.name}
                    </p>
                    <p className="text-[9px] text-[var(--tx3)]/88">{formatShort(f.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/10"
            onClick={() => setLightbox(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoveFilesSection({ moveId, moveStatus }: { moveId: string; moveStatus?: string }) {
  const [photos, setPhotos] = useState<FileEntry[]>([]);
  const [crewPhotos, setCrewPhotos] = useState<FileEntry[]>([]);
  const [podFiles, setPodFiles] = useState<FileEntry[]>([]);
  const [signOff, setSignOff] = useState<SignOffData | null>(null);
  const [documents, setDocuments] = useState<FileEntry[]>([]);
  const [adminFiles, setAdminFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isCompleted = moveStatus === "completed" || moveStatus === "delivered";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [photosRes, crewRes, signoffRes, docsRes, adminRes] = await Promise.all([
        fetch(`/api/admin/moves/${moveId}/photos`).then((r) => r.json()),
        fetch(`/api/admin/moves/${moveId}/crew-photos`).then((r) => r.json()),
        fetch(`/api/admin/moves/${moveId}/signoff`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/admin/moves/${moveId}/documents`).then((r) => r.json()),
        fetch(`/api/admin/move-files?move_id=${moveId}`).then((r) => r.json()).catch(() => ({ files: [] })),
      ]);

      // Move photos
      const pArr: FileEntry[] = (photosRes.photos ?? []).map((p: { id: string; url: string; caption?: string; created_at?: string; source?: string }) => ({
        id: p.id,
        url: p.url,
        name: p.caption || "photo",
        type: "image" as const,
        badge: "photo" as const,
        date: p.created_at || new Date().toISOString(),
        caption: p.caption,
        source: p.source,
      }));
      setPhotos(pArr);

      // Crew checkpoint photos
      const crewArr: FileEntry[] = [];
      for (const g of (crewRes.byCheckpoint ?? [])) {
        for (const p of (g.photos ?? [])) {
          crewArr.push({
            id: p.id,
            url: p.url,
            name: g.label || "crew photo",
            type: "image",
            badge: "photo",
            date: p.takenAt || new Date().toISOString(),
            caption: g.label,
          });
        }
      }
      setCrewPhotos(crewArr);

      // Sign-off / PoD
      const so = signoffRes.signOff || signoffRes;
      if (so?.signed_at) {
        setSignOff(so);
        const podArr: FileEntry[] = [];
        if (so.signature_url) {
          podArr.push({ id: "sig", url: so.signature_url, name: "Signature", type: "image", badge: "pod", date: so.signed_at });
        }
        for (const url of (so.delivery_photo_urls ?? [])) {
          podArr.push({ id: url, url, name: "PoD photo", type: "image", badge: "pod", date: so.signed_at });
        }
        setPodFiles(podArr);
      } else {
        setSignOff(null);
        setPodFiles([]);
      }

      // Documents = move_documents + system-generated PDFs from move_files + Square receipt link
      const squareReceipt = docsRes.square_receipt_url
        ? [{
            id: "square-receipt",
            url: docsRes.square_receipt_url,
            name: "Payment Receipt (Square)",
            type: "other" as const,
            badge: "doc" as const,
            date: new Date().toISOString(),
            deletable: false,
          }]
        : [];
      const docFromApi: FileEntry[] = (docsRes.documents ?? []).map((d: { id: string; view_url?: string; storage_path?: string; external_url?: string; title: string; type: string; created_at?: string }) => ({
        id: d.id,
        url: d.view_url || d.storage_path || d.external_url || "#",
        name: d.title || d.type,
        type: (isPdf(d.view_url || d.storage_path || d.external_url || "") ? "pdf" : "other") as "pdf" | "other",
        badge: "doc" as const,
        date: d.created_at || new Date().toISOString(),
        deletable: true,
      }));
      const systemFiles = (adminRes.files ?? []).filter((f: { source?: string }) => f.source === "system");
      const docFromSystem: FileEntry[] = systemFiles.map((f: { id: string; file_url: string; file_name: string; file_type: string; created_at: string }) => ({
        id: f.id,
        url: f.file_url,
        name: f.file_name,
        type: isPdf(f.file_url, f.file_type) ? "pdf" : "other",
        badge: "doc" as const,
        date: f.created_at,
      }));
      setDocuments([...squareReceipt, ...docFromSystem, ...docFromApi]);

      // Admin uploads (exclude system-generated so they only show under Documents)
      const adminOnly = (adminRes.files ?? []).filter((f: { source?: string }) => f.source !== "system");
      const adminArr: FileEntry[] = adminOnly.map((f: { id: string; file_url: string; file_name: string; file_type: string; created_at: string }) => ({
        id: f.id,
        url: f.file_url,
        name: f.file_name,
        type: isImage(f.file_url, f.file_type) ? "image" : isPdf(f.file_url, f.file_type) ? "pdf" : "other",
        badge: "upload" as const,
        date: f.created_at,
      }));
      setAdminFiles(adminArr);
    } finally {
      setLoading(false);
    }
  }, [moveId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("move_id", moveId);
      const res = await fetch("/api/admin/move-files", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error || "Upload failed", "x");
        return;
      }
      toast("File uploaded", "check");
      fetchAll();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const allPhotoCount = photos.length + crewPhotos.length;
  const hasAny = podFiles.length + allPhotoCount + documents.length + adminFiles.length > 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-heading text-[11px] font-bold tracking-wide uppercase text-[var(--tx3)]">
          Files & Media
        </h3>
        <div className="flex items-center gap-2">
          {isCompleted && (
            <button
              type="button"
              onClick={async () => {
                setRegenerating(true);
                try {
                  const res = await fetch(`/api/admin/moves/${moveId}/regenerate-documents`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast(data.error || "Regenerate failed", "x");
                    return;
                  }
                  toast("Documents regenerated", "check");
                  fetchAll();
                } catch {
                  toast("Regenerate failed", "x");
                } finally {
                  setRegenerating(false);
                }
              }}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--brd)] transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-[11px] h-[11px] ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Regenerating…" : "Regenerate Documents"}
            </button>
          )}
          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] cursor-pointer transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            <Upload className="w-[11px] h-[11px]" />
            {uploading ? "Uploading…" : "Upload File"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : !hasAny ? (
        <p className="text-[11px] text-[var(--tx3)]">No files yet. Upload photos or documents above.</p>
      ) : (
        <div className="space-y-4">
          {/* PoD */}
          <FileGroup
            label="Proof of Delivery"
            borderColor="border-[var(--brd)]"
            files={podFiles}
            defaultOpen
            extra={
              signOff ? (
                <div className="mb-2 ml-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                  {signOff.signed_by && (
                    <div><span className="text-[var(--tx3)]">Signed by: </span>{signOff.signed_by}</div>
                  )}
                  {signOff.signed_at && (
                    <div><span className="text-[var(--tx3)]">Date: </span>{new Date(signOff.signed_at).toLocaleString()}</div>
                  )}
                  {signOff.satisfaction_rating != null && (
                    <div><span className="text-[var(--tx3)]">Rating: </span>{signOff.satisfaction_rating}/5</div>
                  )}
                  {signOff.nps_score != null && (
                    <div><span className="text-[var(--tx3)]">NPS: </span>{signOff.nps_score}</div>
                  )}
                  {signOff.feedback_note && (
                    <div className="col-span-full"><span className="text-[var(--tx3)]">Note: </span>{signOff.feedback_note}</div>
                  )}
                  {signOff.escalation_triggered && (
                    <div className="col-span-full text-red-600 font-semibold flex items-center gap-1.5"><Warning size={13} className="shrink-0" /> Escalation: {signOff.escalation_reason}</div>
                  )}
                  <div className="col-span-full">
                    <a
                      href={`/api/admin/moves/${moveId}/signoff/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--gold)] hover:underline"
                    >
                      Download PDF Receipt
                    </a>
                  </div>
                </div>
              ) : null
            }
          />

          {/* Move & Crew Photos */}
          <FileGroup
            label="Move Photos"
            borderColor="border-[#2D6A4F]"
            files={[...photos, ...crewPhotos]}
            empty="No photos yet."
            defaultOpen={allPhotoCount > 0}
          />

          {/* Documents */}
          <FileGroup
            label="Documents"
            borderColor="border-[#6B2D3E]"
            files={documents}
            empty="No documents linked."
            defaultOpen={false}
            onDeleteFile={async (docId) => {
              try {
                const res = await fetch(`/api/admin/moves/${moveId}/documents/${docId}`, { method: "DELETE" });
                const data = await res.json();
                if (!res.ok) {
                  toast(data.error || "Delete failed", "x");
                  return;
                }
                toast("Document removed", "check");
                fetchAll();
              } catch {
                toast("Delete failed", "x");
              }
            }}
          />

          {/* Admin Uploads */}
          {adminFiles.length > 0 && (
            <FileGroup
              label="Admin Uploads"
              borderColor="border-[var(--brd)]"
              files={adminFiles}
              defaultOpen
            />
          )}
        </div>
      )}
    </div>
  );
}
