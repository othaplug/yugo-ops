import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { moveNotificationEmail } from "@/lib/email-templates";
import { signTrackToken } from "@/lib/track-token";
import { requireAuth } from "@/lib/api-auth";

import { getSuperAdminEmail } from "@/lib/super-admin";

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = (user!.email || "").toLowerCase() === getSuperAdminEmail();
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Super admins may not be in platform_users; use admin client to bypass RLS for DB operations
    const db = isSuperAdmin ? createAdminClient() : supabase;

    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};
    let docFiles: File[] = [];

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      body = Object.fromEntries(
        [...formData.entries()]
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => [k, v])
      ) as Record<string, unknown>;
      const inventoryRaw = formData.get("inventory") as string;
      if (inventoryRaw) body.inventory = JSON.parse(inventoryRaw);
      const assignedRaw = formData.get("assigned_members") as string;
      if (assignedRaw) body.assigned_members = JSON.parse(assignedRaw);
      const complexityRaw = formData.get("complexity_indicators") as string;
      if (complexityRaw) {
        try {
          body.complexity_indicators = JSON.parse(complexityRaw);
        } catch {
          body.complexity_indicators = [];
        }
      }
      docFiles = formData.getAll("documents") as File[];
    } else {
      body = await req.json();
    }

    const moveType = (body.move_type as string) === "office" ? "office" : "residential";
    const clientName = (body.client_name as string)?.trim() || "";
    const clientEmail = (body.client_email as string)?.trim() || null;
    const clientPhone = (body.client_phone as string)?.trim() || null;
    const fromAddress = (body.from_address as string)?.trim() || "";
    const toAddress = (body.to_address as string)?.trim() || "";
    const fromLat = body.from_lat != null ? Number(body.from_lat) : null;
    const fromLng = body.from_lng != null ? Number(body.from_lng) : null;
    const toLat = body.to_lat != null ? Number(body.to_lat) : null;
    const toLng = body.to_lng != null ? Number(body.to_lng) : null;
    const estimate = Number(body.estimate) || 0;
    let organizationId = (body.organization_id as string)?.trim() || null;
    const fromAccess = (body.from_access as string)?.trim() || null;
    const toAccess = (body.to_access as string)?.trim() || null;
    const accessNotesRaw = (body.access_notes as string)?.trim() || null;
    const accessNotesWithAccess =
      [fromAccess && `From: ${fromAccess}`, toAccess && `To: ${toAccess}`, accessNotesRaw].filter(Boolean).join("\n") || null;

    if (!clientName) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    if (!fromAddress) return NextResponse.json({ error: "From address is required" }, { status: 400 });
    if (!toAddress) return NextResponse.json({ error: "To address is required" }, { status: 400 });

    // If no org selected, check for duplicate client before creating
    if (!organizationId && (clientName || clientEmail || clientPhone)) {
      const { data: orgs } = await db
        .from("organizations")
        .select("id, name, contact_name, email, phone")
        .eq("type", "b2c");
      const normalizedPhone = (p: string) => (p || "").replace(/\D/g, "");
      const match = (orgs || []).find((o) => {
        const oEmail = (o.email || "").trim().toLowerCase();
        const oPhone = normalizedPhone((o.phone || "").trim());
        const oName = (o.contact_name || o.name || "").trim().toLowerCase();
        if (clientEmail && oEmail && oEmail === clientEmail.trim().toLowerCase()) return true;
        if (clientPhone && normalizedPhone(clientPhone) && oPhone && oPhone === normalizedPhone(clientPhone)) return true;
        if (clientName && oName && oName === clientName.trim().toLowerCase()) return true;
        return false;
      });
      if (match) {
        return NextResponse.json(
          { error: "Client already exists", existingClient: { id: match.id, name: match.contact_name || match.name } },
          { status: 400 }
        );
      }
    }

    const { data: move, error: insertError } = await db
      .from("moves")
      .insert({
        move_type: moveType,
        organization_id: organizationId,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        from_address: fromAddress,
        to_address: toAddress,
        delivery_address: toAddress,
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: toLat,
        to_lng: toLng,
        estimate,
        status: "confirmed",
        stage: "quote",
        scheduled_date: (body.scheduled_date as string)?.trim() || null,
        scheduled_time: (body.scheduled_time as string)?.trim() || null,
        arrival_window: (body.arrival_window as string)?.trim() || null,
        access_notes: accessNotesWithAccess,
        internal_notes: (body.internal_notes as string)?.trim() || null,
        preferred_contact: (body.preferred_contact as string)?.trim() || null,
        crew_id: (body.crew_id as string)?.trim() || null,
        assigned_members: Array.isArray(body.assigned_members) ? body.assigned_members : [],
        complexity_indicators: Array.isArray(body.complexity_indicators) ? body.complexity_indicators : [],
        updated_at: new Date().toISOString(),
      })
      .select("id, move_code")
      .single();

    if (insertError) {
      console.error("Move insert error:", insertError);
      return NextResponse.json({ error: insertError.message || "Failed to create move" }, { status: 400 });
    }
    if (!move?.id) return NextResponse.json({ error: "Failed to create move" }, { status: 500 });

    const moveId = move.id;

    // If no org was selected, create client and link to move
    if (!organizationId) {
      // Use placeholder email if none provided to avoid unique constraint on empty string
      const orgEmail = (clientEmail || "").trim() || `client-${moveId}@placeholder.local`;
      const { data: newOrg, error: orgError } = await db
        .from("organizations")
        .insert({
          name: clientName,
          type: "b2c",
          contact_name: clientName,
          email: orgEmail,
          phone: clientPhone || "",
          address: null,
          health: "good",
        })
        .select("id")
        .single();
      if (!orgError && newOrg?.id) {
        organizationId = newOrg.id;
        await db.from("moves").update({ organization_id: organizationId }).eq("id", moveId);
      }
    }

    // Add inventory items
    const inventory = Array.isArray(body.inventory) ? body.inventory : [];
    for (const item of inventory) {
      if (item?.room && item?.item_name) {
        await db.from("move_inventory").insert({
          move_id: moveId,
          room: String(item.room),
          item_name: String(item.item_name).trim(),
        });
      }
    }

    // Upload documents
    const bucket = "move-documents";
    for (const file of docFiles) {
        if (file?.size && file.type) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const storagePath = `${moveId}/${safeName}`;
          const buf = await file.arrayBuffer();
          const { error: uploadErr } = await db.storage
            .from(bucket)
            .upload(storagePath, buf, { contentType: file.type, upsert: false });
          if (!uploadErr) {
            await db.from("move_documents").insert({
              move_id: moveId,
              type: "other",
              title: file.name.replace(/\.[^/.]+$/, "") || "Document",
              storage_path: storagePath,
            });
          }
        }
    }

    // Send client email (if email provided and Resend configured). Return emailSent + emailError so UI can show feedback.
    let emailSent = false;
    let emailError: string | null = null;

    if (!clientEmail || !clientEmail.trim()) {
      emailError = 'No client email was provided. Add email on the move and use "Resend tracking link" to send.';
    } else {
      try {
        const resend = getResend();
        const emailTrimmed = clientEmail.trim().toLowerCase();
        const { getEmailBaseUrl } = await import("@/lib/email-base-url");
        const { getMoveCode, formatJobId, getTrackMoveSlug } = await import("@/lib/move-code");
        const moveCode = move.move_code || getMoveCode({ id: moveId });
        const jobIdDisplay = formatJobId(moveCode, "move");
        const depositPaid = Math.round(estimate * 0.25);
        const trackUrl = `${getEmailBaseUrl()}/track/move/${getTrackMoveSlug({ move_code: move.move_code, id: moveId })}?token=${signTrackToken("move", moveId)}`;

        const html = moveNotificationEmail({
          move_id: moveId,
          move_number: jobIdDisplay,
          client_name: clientName || emailTrimmed,
          move_type: moveType,
          status: "pending",
          stage: "quote",
          from_address: fromAddress,
          to_address: toAddress,
          scheduled_date: (body.scheduled_date as string)?.trim() || "",
          estimate,
          deposit_paid: depositPaid,
          balance_due: estimate - depositPaid,
          trackUrl,
        });

        const sendResult = await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: emailTrimmed,
          subject: `Your move has been created — track your move`,
          html,
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });

        if (sendResult?.error) {
          const msg = (sendResult.error as { message?: string }).message ?? String(sendResult.error);
          emailError = msg.includes("domain") || msg.includes("verified") ? `${msg} Verify the sending domain (opsplus.co) in Resend.` : msg;
        } else {
          emailSent = true;
        }
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        emailError = msg.includes("RESEND") ? "Email not configured. Add RESEND_API_KEY to your environment (e.g. Vercel)." : msg;
        console.error("Failed to send move-created email:", emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      id: moveId,
      move_code: move.move_code || undefined,
      emailSent,
      emailError: emailError || undefined,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create move" },
      { status: 500 }
    );
  }
}
