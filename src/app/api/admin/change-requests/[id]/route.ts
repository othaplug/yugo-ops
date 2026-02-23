import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { changeRequestNotificationEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

/** Parse and apply approved change request to move data globally */
async function applyApprovedChange(
  admin: ReturnType<typeof createAdminClient>,
  moveId: string,
  type: string,
  description: string
) {
  const desc = description.trim();
  if (!desc) return;

  if (type === "Change destination address") {
    const match = desc.match(/^New address:\s*([\s\S]+?)(?:\n\n|$)/i);
    const newAddress = match ? match[1].trim() : desc.replace(/^New address:\s*/i, "").split("\n\n")[0]?.trim();
    if (newAddress) {
      await admin
        .from("moves")
        .update({ to_address: newAddress, delivery_address: newAddress })
        .eq("id", moveId);
    }
    return;
  }

  if (type === "Add items to inventory") {
    const lines = desc
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const { data: existing } = await admin
      .from("move_inventory")
      .select("sort_order")
      .eq("move_id", moveId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let sortOrder = (existing?.sort_order ?? 0) + 1;
    for (const itemName of lines) {
      if (!itemName) continue;
      await admin.from("move_inventory").insert({
        move_id: moveId,
        room: "Other",
        item_name: itemName,
        sort_order: sortOrder++,
      });
    }
    return;
  }

  if (type === "Add special instructions") {
    const { data: move } = await admin.from("moves").select("internal_notes").eq("id", moveId).single();
    const existing = (move?.internal_notes || "").trim();
    const prefix = existing ? "\n\n" : "";
    const appended = `${existing}${prefix}[Change request] ${desc}`;
    await admin.from("moves").update({ internal_notes: appended }).eq("id", moveId);
    return;
  }

  if (type === "Change move date") {
    const dateMatch = desc.match(
      /(\d{4})-(\d{2})-(\d{2})|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?/i
    );
    if (dateMatch) {
      let dateStr: string;
      if (dateMatch[1]) {
        dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      } else {
        const months: Record<string, string> = {
          jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
          jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
        };
        const m = months[(dateMatch[4] || "").toLowerCase().slice(0, 3)] || "01";
        const d = (dateMatch[5] || "1").padStart(2, "0");
        const y = dateMatch[7] || new Date().getFullYear();
        dateStr = `${y}-${m}-${d}`;
      }
      await admin.from("moves").update({ scheduled_date: dateStr }).eq("id", moveId);
    }
    return;
  }

  if (type === "Change move time") {
    const window = desc.replace(/\n+/g, " ").trim().slice(0, 120);
    if (window) {
      await admin.from("moves").update({ arrival_window: window }).eq("id", moveId);
    }
    return;
  }

  if (type === "Remove items from inventory") {
    const lines = desc
      .replace(/^remove\s*(items?)?\s*:?\s*/i, "")
      .split(/[\n,]+/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    if (lines.length === 0) return;
    const { data: items } = await admin
      .from("move_inventory")
      .select("id, item_name")
      .eq("move_id", moveId);
    for (const item of items || []) {
      const nameLower = (item.item_name || "").toLowerCase();
      const matches = lines.some((line) => nameLower.includes(line) || line.includes(nameLower));
      if (matches) {
        await admin.from("move_inventory").delete().eq("id", item.id);
      }
    }
    return;
  }

  // Upgrade service tier / Other: no dedicated fields; append to internal_notes for record
  if (type === "Upgrade service tier" || type === "Other") {
    const { data: move } = await admin.from("moves").select("internal_notes").eq("id", moveId).single();
    const existing = (move?.internal_notes || "").trim();
    const prefix = existing ? "\n\n" : "";
    const appended = `${existing}${prefix}[Change request: ${type}] ${desc}`;
    await admin.from("moves").update({ internal_notes: appended }).eq("id", moveId);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
    const feeCents = typeof body.fee_cents === "number" && body.fee_cents >= 0 ? Math.round(body.fee_cents) : 0;

    if (!status) {
      return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: request, error: fetchErr } = await admin
      .from("move_change_requests")
      .select("id, move_id, type, description")
      .eq("id", id)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 400 });
    }

    const { error } = await admin
      .from("move_change_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
        fee_cents: status === "approved" ? feeCents : 0,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (status === "approved") {
      await applyApprovedChange(admin, request.move_id, request.type, request.description);
    }

    const { data: requestWithFee } = await admin
      .from("move_change_requests")
      .select("fee_cents")
      .eq("id", id)
      .single();

    const { data: move } = await admin
      .from("moves")
      .select("client_email, client_name")
      .eq("id", request.move_id)
      .single();

    const feeCentsFinal = status === "approved" ? (requestWithFee?.fee_cents ?? feeCents) : 0;

    if (move?.client_email && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const trackUrl = `${getEmailBaseUrl()}/track/move/${request.move_id}?token=${signTrackToken("move", request.move_id)}`;
        const html = changeRequestNotificationEmail({
          client_name: move.client_name || "Client",
          status,
          type: request.type,
          description: request.description,
          portalUrl: trackUrl,
          feeCents: feeCentsFinal,
        });
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: move.client_email,
          subject: `Your change request has been ${status === "approved" ? "approved" : "declined"}`,
          html,
        });
      } catch {
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
