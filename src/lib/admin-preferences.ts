import "server-only";
import { getDb } from "./db";
import {
  normalizeVehicleGroupOrder,
  type VehicleGroupKey,
} from "./vehicle-groups";

export function getAdminVehicleGroupOrder(userId: number): VehicleGroupKey[] {
  const row = getDb()
    .prepare("SELECT vehicle_group_order FROM admin_users WHERE id = ?")
    .get(userId) as { vehicle_group_order: string | null } | undefined;

  if (!row?.vehicle_group_order) return normalizeVehicleGroupOrder(null);

  try {
    const parsed = JSON.parse(row.vehicle_group_order);
    return normalizeVehicleGroupOrder(parsed);
  } catch {
    return normalizeVehicleGroupOrder(null);
  }
}

export function updateAdminVehicleGroupOrder(
  userId: number,
  order: unknown
): VehicleGroupKey[] {
  const normalized = normalizeVehicleGroupOrder(order);
  getDb()
    .prepare(
      "UPDATE admin_users SET vehicle_group_order = ?, updated_at = ? WHERE id = ?"
    )
    .run(JSON.stringify(normalized), new Date().toISOString(), userId);
  return normalized;
}
