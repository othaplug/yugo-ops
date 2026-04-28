import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { isUuid, getDeliveryDetailPath } from "@/lib/move-code";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import DeliveryDetailClient, {
  type DeliveryStopItem,
} from "./DeliveryDetailClient";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const db = createAdminClient();
  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await db.from("deliveries").select("delivery_number").eq("id", slug).single()
    : await db.from("deliveries").select("delivery_number").ilike("delivery_number", slug).single();
  const name = delivery?.delivery_number ? `Delivery ${delivery.delivery_number}` : "Delivery";
  return { title: name };
}

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const db = createAdminClient();
  const byUuid = isUuid(slug);

  const { data: delivery, error } = byUuid
    ? await db.from("deliveries").select("*").eq("id", slug).single()
    : await db.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();

  if (byUuid && delivery.delivery_number?.trim()) {
    redirect(getDeliveryDetailPath(delivery));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db.from("platform_users").select("role").eq("user_id", user?.id ?? "").single();
  const canEditPostCompletionPrice = canEditFinalJobPrice(pu?.role ?? null, user?.email ?? null);

  const isDayRate = delivery.booking_type === "day_rate";
  const isMultiStop = !!(delivery as { is_multi_stop?: boolean }).is_multi_stop;
  const loadDeliveryStops = isDayRate || isMultiStop;
  const [
    { data: org },
    { data: orgs },
    { data: crews },
    { data: etaSmsLog },
    { data: deliveryInvoice },
    stopsResult,
    projectResult,
    { data: postCompletionPriceEdits },
  ] = await Promise.all([
    db.from("organizations").select("email").eq("name", delivery.client_name).limit(1).maybeSingle(),
    db.from("organizations").select("id, name, type").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
    db.from("eta_sms_log").select("message_type, sent_at, eta_minutes, twilio_sid").eq("delivery_id", delivery.id).order("sent_at", { ascending: false }),
    db.from("invoices").select("id, invoice_number, square_invoice_url, status").eq("delivery_id", delivery.id).maybeSingle(),
    loadDeliveryStops
      ? db
          .from("delivery_stops")
          .select(
            "id, stop_number, address, customer_name, customer_phone, client_phone, vendor_name, contact_name, contact_phone, access_type, access_notes, readiness, readiness_notes, items_description, special_instructions, notes, stop_status, stop_type, arrived_at, completed_at, is_final_destination",
          )
          .eq("delivery_id", delivery.id)
          .order("stop_number")
      : Promise.resolve({ data: null }),
    delivery.project_id
      ? db.from("projects").select("id, project_number, project_name").eq("id", delivery.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("job_final_price_edits")
      .select(
        "id, original_price, new_price, difference, reason, edited_by_name, created_at, invoice_may_need_reissue",
      )
      .eq("job_id", delivery.id)
      .eq("job_type", "delivery")
      .order("created_at", { ascending: false }),
  ]);

  type StopRow = {
    id: string;
    stop_number: number;
    address: string;
    customer_name: string | null;
    customer_phone: string | null;
    client_phone?: string | null;
    vendor_name?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    access_type?: string | null;
    access_notes?: string | null;
    readiness?: string | null;
    readiness_notes?: string | null;
    items_description: string | null;
    special_instructions: string | null;
    notes?: string | null;
    stop_status?: string | null;
    stop_type?: string | null;
    arrived_at?: string | null;
    completed_at?: string | null;
    is_final_destination?: boolean | null;
    stop_items?: DeliveryStopItem[];
  };

  let stops =
    (stopsResult as { data: StopRow[] | null })?.data ?? null;

  if (stops && stops.length > 0 && isMultiStop) {
    type StopItemRow = {
      id: string;
      stop_id: string;
      description: string;
      quantity: number;
      weight_range: string | null;
      is_fragile: boolean | null;
      is_high_value: boolean | null;
      requires_assembly: boolean | null;
      status: string | null;
    };
    const { data: stopItems } = await db
      .from("delivery_stop_items")
      .select(
        "id, stop_id, description, quantity, weight_range, is_fragile, is_high_value, requires_assembly, status",
      )
      .in(
        "stop_id",
        stops.map((s) => s.id),
      );
    const byStop: Record<string, DeliveryStopItem[]> = {};
    for (const row of (stopItems || []) as StopItemRow[]) {
      const sid = row.stop_id;
      if (!byStop[sid]) byStop[sid] = [];
      byStop[sid].push({
        id: row.id,
        description: row.description,
        quantity: row.quantity,
        weight_range: row.weight_range,
        is_fragile: row.is_fragile,
        is_high_value: row.is_high_value,
        requires_assembly: row.requires_assembly,
        status: row.status,
      });
    }
    stops = stops.map((s) => ({
      ...s,
      stop_items: byStop[s.id] || [],
    }));
  }

  const deliveryOrg = delivery.organization_id
    ? (orgs || []).find((o: { id: string }) => o.id === delivery.organization_id)
    : null;
  const isB2BPartner = !!deliveryOrg && deliveryOrg.type !== "b2c";

  // Resolve phase name if delivery is linked to a project phase
  let phaseName: string | null = null;
  if (delivery.phase_id && projectResult?.data) {
    const { data: phaseRow } = await db.from("project_phases").select("phase_name").eq("id", delivery.phase_id).maybeSingle();
    phaseName = phaseRow?.phase_name ?? null;
  }

  const linkedProject = projectResult?.data
    ? { ...projectResult.data, phase_name: phaseName }
    : null;

  let b2bOneOffPriorCount = 0;
  let b2bOneOffCohort: {
    verticalLabel: string | null;
    combinedRevenue: number;
    deliveryCount: number;
  } | null = null;

  if (delivery.booking_type === "one_off" && !delivery.organization_id && delivery.contact_email) {
    const emailNorm = delivery.contact_email.trim();
    const { count } = await db
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("booking_type", "one_off")
      .is("organization_id", null)
      .ilike("contact_email", emailNorm)
      .neq("id", delivery.id);
    b2bOneOffPriorCount = count ?? 0;

    const { data: cohortRows } = await db
      .from("deliveries")
      .select("total_price, admin_adjusted_price, base_price, final_price, calculated_price, override_price, quoted_price")
      .eq("booking_type", "one_off")
      .is("organization_id", null)
      .ilike("contact_email", emailNorm);
    const cohortList = cohortRows ?? [];
    const lineRev = (r: Parameters<typeof effectiveDeliveryPrice>[0]) => effectiveDeliveryPrice(r);
    const combinedRevenue = cohortList.reduce((s, r) => s + lineRev(r), 0);
    let verticalLabel: string | null = null;
    const vCode = delivery.vertical_code as string | null | undefined;
    if (vCode && String(vCode).trim()) {
      const { data: vn } = await db.from("delivery_verticals").select("name").eq("code", String(vCode).trim()).maybeSingle();
      verticalLabel = vn?.name ?? String(vCode).replace(/_/g, " ");
    }
    b2bOneOffCohort = {
      verticalLabel,
      combinedRevenue,
      deliveryCount: cohortList.length,
    };
  }

  return (
    <DeliveryDetailClient
      delivery={delivery}
      clientEmail={org?.email}
      organizations={orgs || []}
      crews={crews || []}
      stops={stops}
      etaSmsLog={etaSmsLog ?? []}
      deliveryInvoice={deliveryInvoice ?? null}
      isB2BPartner={isB2BPartner}
      linkedProject={linkedProject}
      b2bOneOffPriorCount={b2bOneOffPriorCount}
      b2bOneOffCohort={b2bOneOffCohort}
      canEditPostCompletionPrice={canEditPostCompletionPrice}
      postCompletionPriceEdits={postCompletionPriceEdits ?? []}
    />
  );
}
