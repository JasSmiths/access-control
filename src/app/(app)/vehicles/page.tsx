import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getAdminVehicleGroupOrder } from "@/lib/admin-preferences";
import {
  normalizeVehicleRoleGroup,
  normalizeVehicleGroupOrder,
  VEHICLE_GROUP_TITLES,
  type VehicleGroupKey,
} from "@/lib/vehicle-groups";
import { VehiclesPageClient } from "@/components/vehicles/VehiclesPageClient";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const session = await getSession();
  const rows = getDb()
    .prepare("SELECT * FROM contractors ORDER BY name ASC")
    .all() as ContractorRow[];
  const order = session
    ? getAdminVehicleGroupOrder(session.userId)
    : normalizeVehicleGroupOrder(null);
  const rowsByGroup = rows.reduce<Record<VehicleGroupKey, ContractorRow[]>>(
    (acc, row) => {
      const key = normalizeVehicleRoleGroup(row.role);
      acc[key].push(row);
      return acc;
    },
    { family: [], friends: [], visitors: [], contractors: [] }
  );
  const groupedRows = order.map((key) => ({
    key,
    title: VEHICLE_GROUP_TITLES[key],
    rows: rowsByGroup[key],
  }));

  return <VehiclesPageClient initialGroups={groupedRows} />;
}
