export const VEHICLE_GROUP_KEYS = [
  "family",
  "friends",
  "visitors",
  "contractors",
] as const;

export type VehicleGroupKey = (typeof VEHICLE_GROUP_KEYS)[number];

export const VEHICLE_GROUP_TITLES: Record<VehicleGroupKey, string> = {
  family: "Family",
  friends: "Friends",
  visitors: "Visitors",
  contractors: "Contractors",
};

export function isVehicleGroupKey(value: string): value is VehicleGroupKey {
  return (VEHICLE_GROUP_KEYS as readonly string[]).includes(value);
}

export function normalizeVehicleRoleGroup(role: string | null | undefined): VehicleGroupKey {
  const value = (role ?? "").trim().toLowerCase();
  if (value === "family") return "family";
  if (value === "friend" || value === "friends") return "friends";
  if (value === "visitor" || value === "visitors") return "visitors";
  return "contractors";
}

export function normalizeVehicleGroupOrder(input: unknown): VehicleGroupKey[] {
  const list = Array.isArray(input)
    ? input
        .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((v): v is VehicleGroupKey => isVehicleGroupKey(v))
    : [];

  const deduped = [...new Set(list)];
  if (deduped.length !== VEHICLE_GROUP_KEYS.length) return [...VEHICLE_GROUP_KEYS];
  return deduped;
}
