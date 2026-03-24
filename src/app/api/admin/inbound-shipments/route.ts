import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInboundShipmentLog } from "@/lib/inbound-shipment-service";
import { notifyInboundShipmentStakeholders } from "@/lib/inbound-shipment-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("inbound_shipments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = rows || [];
  const stats = {
    awaiting: list.filter((r) => r.status === "awaiting_shipment").length,
    in_transit: list.filter((r) => r.status === "in_transit").length,
    at_facility: list.filter((r) =>
      ["received", "inspecting", "inspection_failed", "stored"].includes(r.status),
    ).length,
    ready: list.filter((r) =>
      ["customer_contacted", "delivery_scheduled", "out_for_delivery"].includes(r.status),
    ).length,
    delivered: list.filter((r) => ["delivered", "completed"].includes(r.status)).length,
  };

  const repeatSenders: { email: string; count: number; business_name: string | null }[] = [];
  const byEmail = new Map<string, { count: number; business_name: string | null }>();
  for (const r of list) {
    if (r.organization_id) continue;
    const em = (r.business_email || "").trim().toLowerCase();
    if (!em) continue;
    const cur = byEmail.get(em) || { count: 0, business_name: r.business_name };
    cur.count += 1;
    if (!cur.business_name && r.business_name) cur.business_name = r.business_name;
    byEmail.set(em, cur);
  }
  for (const [email, v] of byEmail) {
    if (v.count >= 2) repeatSenders.push({ email, count: v.count, business_name: v.business_name });
  }

  return NextResponse.json({ shipments: list, stats, repeatSenders });
}

export async function POST(req: NextRequest) {
  const { error: authErr, user } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const {
      organization_id,
      partner_name,
      partner_contact_name,
      partner_contact_email,
      partner_contact_phone,
      business_name,
      business_email,
      business_phone,
      carrier_name,
      carrier_tracking_number,
      carrier_eta,
      items,
      total_pieces,
      customer_later,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      customer_postal,
      customer_access,
      customer_notes,
      service_level,
      requires_move_inside,
      requires_assembly,
      requires_unboxing,
      requires_debris_removal,
      requires_pod,
      receiving_inspection_tier,
      assembly_complexity,
      special_instructions,
      partner_issue_phone,
      delivery_price,
      assembly_price,
      storage_price,
      receiving_fee,
      total_price,
      billing_method,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const db = createAdminClient();
    let orgSnap = {
      partner_name: partner_name as string | null,
      partner_contact_name: partner_contact_name as string | null,
      partner_contact_email: partner_contact_email as string | null,
      partner_contact_phone: partner_contact_phone as string | null,
    };

    if (organization_id) {
      const { data: org } = await db
        .from("organizations")
        .select("name, contact_name, email, phone")
        .eq("id", organization_id)
        .single();
      if (org) {
        orgSnap = {
          partner_name: org.name ?? orgSnap.partner_name,
          partner_contact_name: org.contact_name ?? orgSnap.partner_contact_name,
          partner_contact_email: org.email ?? orgSnap.partner_contact_email,
          partner_contact_phone: org.phone ?? orgSnap.partner_contact_phone,
        };
      }
    }

    const hasCustomerNow = !customer_later;
    const insert = {
      organization_id: organization_id || null,
      partner_name: orgSnap.partner_name,
      partner_contact_name: orgSnap.partner_contact_name,
      partner_contact_email: orgSnap.partner_contact_email,
      partner_contact_phone: orgSnap.partner_contact_phone,
      business_name: business_name || null,
      business_email: business_email || null,
      business_phone: business_phone || null,
      carrier_name: carrier_name || null,
      carrier_tracking_number: carrier_tracking_number || null,
      carrier_eta: carrier_eta || null,
      items,
      total_pieces: total_pieces ?? items.reduce((acc: number, it: { boxes?: number }) => acc + (Number(it.boxes) || 1), 0),
      customer_name: hasCustomerNow ? customer_name || null : null,
      customer_email: hasCustomerNow ? customer_email || null : null,
      customer_phone: hasCustomerNow ? customer_phone || null : null,
      customer_address: hasCustomerNow ? customer_address || null : null,
      customer_postal: hasCustomerNow ? customer_postal || null : null,
      customer_access: hasCustomerNow ? customer_access || null : null,
      customer_notes: hasCustomerNow ? customer_notes || null : null,
      customer_provided_at: hasCustomerNow ? new Date().toISOString() : null,
      service_level: service_level || "white_glove",
      requires_move_inside: requires_move_inside !== false,
      requires_assembly: !!requires_assembly,
      requires_unboxing: requires_unboxing !== false,
      requires_debris_removal: requires_debris_removal !== false,
      requires_pod: requires_pod !== false,
      receiving_inspection_tier: receiving_inspection_tier === "standard" ? "standard" : "detailed",
      assembly_complexity: assembly_complexity || null,
      special_instructions: special_instructions || null,
      partner_issue_phone: partner_issue_phone || null,
      delivery_price: delivery_price ?? null,
      assembly_price: assembly_price ?? 0,
      storage_price: storage_price ?? 0,
      receiving_fee: receiving_fee ?? null,
      total_price: total_price ?? null,
      billing_method: billing_method || "partner",
      status: "awaiting_shipment",
    };

    const { data: created, error } = await db.from("inbound_shipments").insert(insert).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await appendInboundShipmentLog(db, created.id, "awaiting_shipment", {
      notes: "Shipment created",
      createdBy: user?.email ?? user?.id ?? null,
    });

    void notifyInboundShipmentStakeholders(
      {
        id: created.id,
        shipment_number: created.shipment_number,
        organization_id: created.organization_id,
        partner_name: created.partner_name,
        partner_contact_email: created.partner_contact_email,
        business_email: created.business_email,
        business_name: created.business_name,
        customer_name: created.customer_name,
        customer_email: created.customer_email,
        customer_phone: created.customer_phone,
        customer_address: created.customer_address,
        carrier_name: created.carrier_name,
        carrier_tracking_number: created.carrier_tracking_number,
        carrier_eta: created.carrier_eta,
        items: created.items,
        status: created.status,
        inspection_notes: created.inspection_notes,
        delivery_scheduled_date: created.delivery_scheduled_date,
        delivery_window: created.delivery_window,
      },
      "created",
    );

    return NextResponse.json({ shipment: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 500 },
    );
  }
}
