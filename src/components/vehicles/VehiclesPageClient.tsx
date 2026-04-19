"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { VehiclesGroupsBoard } from "@/components/vehicles/VehiclesGroupsBoard";
import type { ContractorRow } from "@/lib/sessions";
import type { VehicleGroupKey } from "@/lib/vehicle-groups";

type VehicleGroupSection = {
  key: VehicleGroupKey;
  title: string;
  rows: ContractorRow[];
};

export function VehiclesPageClient({
  initialGroups,
}: {
  initialGroups: VehicleGroupSection[];
}) {
  const [orderState, setOrderState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Manage tracked vehicles by category. Click any row to edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-[120px] flex justify-end">
            {orderState === "saved" ? <Badge tone="accent">Order saved</Badge> : null}
            {orderState === "error" ? <Badge tone="danger">Save failed</Badge> : null}
          </div>
          <Link href="/vehicles/new">
            <Button>
              <Plus size={16} /> New vehicle
            </Button>
          </Link>
        </div>
      </div>

      <VehiclesGroupsBoard initialGroups={initialGroups} onStateChange={setOrderState} />
    </div>
  );
}
