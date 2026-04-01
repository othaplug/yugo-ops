/** Single-line label for fleet vehicles in admin / crew UIs */
export function formatFleetVehicleLabel(v: { display_name: string; license_plate: string }): string {
  const name = (v.display_name || "").trim();
  const plate = (v.license_plate || "").trim();
  if (name && plate) return `${name} · ${plate}`;
  return name || plate || "Vehicle";
}

export type FleetVehicleListRow = {
  id: string;
  display_name: string;
  license_plate: string;
  phone?: string | null;
};

/** Shape expected by iPad setup codes and legacy "trucks" admin list */
export function fleetVehicleToTruckListRow(row: FleetVehicleListRow): { id: string; name: string; phone: string | null } {
  return {
    id: row.id,
    name: formatFleetVehicleLabel(row),
    phone: row.phone ?? null,
  };
}
