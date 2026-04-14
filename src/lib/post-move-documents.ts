import { createAdminClient } from "@/lib/supabase/admin";
import { generateMoveInvoicePDF, generateMoveSnapshotPDF } from "@/lib/pdf";
import type { MoveInvoiceData, MoveSnapshotData } from "@/lib/pdf";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";

export async function generatePostMoveDocuments(moveId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("*")
    .eq("id", moveId)
    .single();
  if (!move) return;

  const moveCode = move.move_code || moveId.slice(0, 8).toUpperCase();
  const estimate = Number(move.estimate ?? move.amount ?? 0);
  const depositPaid = Number(move.deposit_amount ?? Math.round(estimate * 0.25));
  const baseBalance = Number(move.balance_amount ?? (estimate - depositPaid));

  // Fetch related data in parallel
  const [
    { data: extraItems },
    { data: changeRequests },
    { data: inventory },
    { data: signOff },
    { data: incidents },
    { data: photos },
    { data: trackingSession },
    { data: crew },
  ] = await Promise.all([
    admin.from("extra_items").select("*").eq("job_id", moveId).eq("job_type", "move"),
    admin.from("move_change_requests").select("*").eq("move_id", moveId),
    admin.from("move_inventory").select("id").eq("move_id", moveId),
    admin.from("client_sign_offs").select("*").eq("job_id", moveId).eq("job_type", "move").maybeSingle(),
    admin.from("incidents").select("*").eq("move_id", moveId),
    admin.from("move_photos").select("id").eq("move_id", moveId),
    admin.from("tracking_sessions")
      .select("checkpoints, created_at, completed_at")
      .eq("job_id", moveId)
      .eq("job_type", "move")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    move.crew_id
      ? admin.from("crews").select("name, members").eq("id", move.crew_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const extras = extraItems ?? [];
  const changes = changeRequests ?? [];
  const approvedExtras = extras.filter((e) => e.status === "approved");
  const approvedChanges = changes.filter((c) => c.status === "approved");

  const extraFeesCents = approvedExtras.reduce((s, e) => s + (Number(e.fee_cents) || 0), 0);
  const changeFeesCents = approvedChanges.reduce((s, c) => s + (Number(c.fee_cents) || 0), 0);
  const totalBalance = baseBalance + (extraFeesCents + changeFeesCents) / 100;

  const completedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const scheduledDate = move.scheduled_date
    ? new Date(move.scheduled_date).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "-";

  const checkpoints = Array.isArray(trackingSession?.checkpoints) ? trackingSession.checkpoints : [];

  // ─── Generate Invoice PDF ───
  const invoiceNumber = opsInvoiceNumberForSquareJob({
    jobType: "move",
    referenceCode: moveCode,
  });

  const invoiceData: MoveInvoiceData = {
    invoiceNumber,
    clientName: move.client_name || "Client",
    clientEmail: move.client_email,
    clientPhone: move.client_phone,
    moveCode: `#${moveCode}`,
    fromAddress: move.from_address || "",
    toAddress: move.to_address || move.delivery_address || "",
    scheduledDate,
    completedDate,
    estimate,
    depositPaid,
    balanceDue: totalBalance,
    extraItems: approvedExtras.map((e) => ({
      description: e.description || "Extra item",
      quantity: e.quantity || 1,
      feeCents: Number(e.fee_cents) || 0,
    })),
    changeFees: approvedChanges
      .filter((c) => Number(c.fee_cents) > 0)
      .map((c) => ({
        description: c.change_type || c.type || "Change request",
        feeCents: Number(c.fee_cents),
      })),
  };

  const invoicePdf = generateMoveInvoicePDF(invoiceData);
  const invoiceBuffer = Buffer.from(invoicePdf.output("arraybuffer"));

  // ─── Generate Move Snapshot PDF ───
  const snapshotData: MoveSnapshotData = {
    moveCode: `#${moveCode}`,
    clientName: move.client_name || "Client",
    clientEmail: move.client_email,
    clientPhone: move.client_phone,
    fromAddress: move.from_address || "",
    toAddress: move.to_address || move.delivery_address || "",
    scheduledDate,
    completedDate,
    moveType: move.move_type || undefined,
    serviceType: move.service_type || undefined,
    tierSelected: move.tier_selected || undefined,
    crewName: crew?.name || undefined,
    crewMembers: Array.isArray(crew?.members) ? crew.members : undefined,
    vehicleType: move.vehicle_type || undefined,
    estimate,
    depositPaid,
    balanceDue: totalBalance,
    checkpoints: checkpoints.map((cp: { status?: string; timestamp?: string; note?: string }) => ({
      status: cp.status || "unknown",
      timestamp: cp.timestamp || new Date().toISOString(),
      note: cp.note || null,
    })),
    inventoryCount: inventory?.length ?? 0,
    extraItems: extras.map((e) => ({
      description: e.description || "Extra item",
      quantity: e.quantity || 1,
      status: e.status || "pending",
      feeCents: Number(e.fee_cents) || 0,
    })),
    changeRequests: changes.map((c) => ({
      type: c.change_type || c.type || "Change",
      details: c.details || c.description || "-",
      status: c.status || "pending",
      feeCents: Number(c.fee_cents) || 0,
    })),
    incidents: (incidents ?? []).map((i) => ({
      type: i.type || i.incident_type || "Incident",
      description: i.description || i.notes || "-",
      severity: i.severity || undefined,
    })),
    signOff: signOff
      ? {
          signedBy: signOff.signed_by || "Client",
          signedAt: signOff.signed_at || new Date().toISOString(),
          satisfactionRating: signOff.satisfaction_rating,
          npsScore: signOff.nps_score,
          feedbackNote: signOff.feedback_note,
          exceptions: signOff.exceptions,
        }
      : null,
    photosCount: photos?.length ?? 0,
  };

  const snapshotPdf = generateMoveSnapshotPDF(snapshotData);
  const snapshotBuffer = Buffer.from(snapshotPdf.output("arraybuffer"));

  // ─── Upload to Supabase Storage ───
  const invoicePath = `${moveId}/invoice-${invoiceNumber}.pdf`;
  const snapshotPath = `${moveId}/move-snapshot-${moveCode}.pdf`;

  const [invoiceUpload, snapshotUpload] = await Promise.all([
    admin.storage.from("move-documents").upload(invoicePath, invoiceBuffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
    admin.storage.from("move-documents").upload(snapshotPath, snapshotBuffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
  ]);

  // Get public URLs
  const invoiceUrl = admin.storage.from("move-documents").getPublicUrl(invoicePath).data.publicUrl;
  const snapshotUrl = admin.storage.from("move-documents").getPublicUrl(snapshotPath).data.publicUrl;

  // ─── Create document records ───
  await Promise.all([
    !invoiceUpload.error &&
      admin.from("move_documents").insert({
        move_id: moveId,
        type: "invoice",
        title: `Invoice ${invoiceNumber}`,
        storage_path: invoicePath,
      }),
    !snapshotUpload.error &&
      admin.from("move_documents").insert({
        move_id: moveId,
        type: "other",
        title: "Move Snapshot",
        storage_path: snapshotPath,
      }),
  ]);

  // ─── Create/update invoice record ───
  const { data: existingInv } = await admin
    .from("invoices")
    .select("id")
    .eq("move_id", moveId)
    .limit(1)
    .maybeSingle();

  if (!existingInv && estimate > 0) {
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const lineItems = [
      { d: "Moving Service", q: 1, r: estimate },
      ...approvedExtras
        .filter((e) => Number(e.fee_cents) > 0)
        .map((e) => ({
          d: `Extra: ${e.description || "Item"}`,
          q: e.quantity || 1,
          r: Number(e.fee_cents) / 100,
        })),
      ...approvedChanges
        .filter((c) => Number(c.fee_cents) > 0)
        .map((c) => ({
          d: `Change: ${c.change_type || "Request"}`,
          q: 1,
          r: Number(c.fee_cents) / 100,
        })),
    ];

    await admin.from("invoices").insert({
      invoice_number: invoiceNumber,
      client_name: move.client_name || "Client",
      amount: Math.round(estimate + (extraFeesCents + changeFeesCents) / 100),
      status: "sent",
      due_date: dueDate,
      move_id: moveId,
      line_items: JSON.stringify(lineItems),
    });
  }

  // Audit event
  await admin.from("status_events").insert({
    entity_type: "move",
    entity_id: moveCode,
    event_type: "documents_generated",
    description: `Invoice ${invoiceNumber} and Move Snapshot generated`,
    icon: "file",
  }).then(() => {}, () => {});
}
