"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContractorsTable } from "@/components/contractors/ContractorsTable";
import type { ContractorRow } from "@/lib/sessions";
import type { VehicleGroupKey } from "@/lib/vehicle-groups";

type VehicleGroupSection = {
  key: VehicleGroupKey;
  title: string;
  rows: ContractorRow[];
};

export function VehiclesGroupsBoard({
  initialGroups,
  onStateChange,
}: {
  initialGroups: VehicleGroupSection[];
  onStateChange?: (state: "idle" | "saving" | "saved" | "error") => void;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function setSyncState(next: "idle" | "saving" | "saved" | "error") {
    setState(next);
    onStateChange?.(next);
  }

  async function persistOrder(
    next: VehicleGroupSection[],
    previous: VehicleGroupSection[]
  ) {
    setSyncState("saving");
    try {
      const res = await fetch("/api/admin-users/preferences/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((g) => g.key) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSyncState("saved");
      setTimeout(() => setSyncState("idle"), 1300);
    } catch {
      setGroups(previous);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 2200);
    }
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;

    const previous = [...groups];
    const next = [...groups];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    setGroups(next);
    void persistOrder(next, previous);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {groups.map((group, index) => (
        <Card key={group.key} className="h-full">
          <CardHeader className="flex items-center justify-between gap-4">
            <CardTitle>
              {group.title} ({group.rows.length})
            </CardTitle>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                onClick={() => moveGroup(index, -1)}
                disabled={index === 0 || state === "saving"}
                title={`Move ${group.title} up`}
                aria-label={`Move ${group.title} up`}
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                onClick={() => moveGroup(index, 1)}
                disabled={index === groups.length - 1 || state === "saving"}
                title={`Move ${group.title} down`}
                aria-label={`Move ${group.title} down`}
              >
                <ArrowDown size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {group.rows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--fg-muted)]">
                No {group.title.toLowerCase()} vehicles yet.
              </div>
            ) : (
              <ContractorsTable rows={group.rows} />
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
