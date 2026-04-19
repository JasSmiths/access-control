"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { clsx } from "@/components/ui/clsx";

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAY_OPTIONS)[number];
const TYPE_OPTIONS = [
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "visitors", label: "Visitors" },
  { value: "contractors", label: "Contractors" },
] as const;
type VehicleType = (typeof TYPE_OPTIONS)[number]["value"];
type VehicleTypeValue = VehicleType | "";
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export type ContractorFormValues = {
  name: string;
  role?: string | null;
  vehicle_reg: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active?: number;
  allowed_hours?: string | null;
  allowed_days?: string;
};

function parseCustomDays(allowed_days: string): Day[] {
  if (!allowed_days.startsWith("custom:")) return [];
  return allowed_days
    .slice(7)
    .split(",")
    .map((d) => d.trim())
    .filter((d): d is Day => (DAY_OPTIONS as readonly string[]).includes(d));
}

function parseAllowedHours(allowedHours: string | null | undefined) {
  const fallback = { enabled: false, start: "07:00", end: "19:00" };
  const value = (allowedHours ?? "").trim();
  if (!value) return fallback;
  const parts = value.split("-");
  if (parts.length !== 2) return fallback;
  const [start, end] = parts;
  if (!TIME_OPTIONS.includes(start) || !TIME_OPTIONS.includes(end)) return fallback;
  return { enabled: true, start, end };
}

function normalizeType(value: string | null | undefined): VehicleTypeValue {
  const role = (value ?? "").trim().toLowerCase();
  if (!role) return "";
  if (role === "family") return "family";
  if (role === "friend" || role === "friends") return "friends";
  if (role === "visitor" || role === "visitors") return "visitors";
  if (role === "contractor" || role === "contractors") return "contractors";
  return "";
}

export function ContractorForm({
  initial,
  contractorId,
}: {
  initial?: ContractorFormValues;
  contractorId?: number;
}) {
  const router = useRouter();
  const editing = !!contractorId;
  const [values, setValues] = useState<ContractorFormValues>(
    initial ?? {
      name: "",
      role: "",
      vehicle_reg: "",
      phone: "",
      email: "",
      notes: "",
      active: 1,
      allowed_hours: "",
      allowed_days: "all",
    }
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedHours = parseAllowedHours(initial?.allowed_hours);
  const [hoursEnabled, setHoursEnabled] = useState(parsedHours.enabled);
  const [hoursStart, setHoursStart] = useState(parsedHours.start);
  const [hoursEnd, setHoursEnd] = useState(parsedHours.end);
  const selectedType = normalizeType(values.role);
  const showAccessControls = !!selectedType && selectedType !== "family";

  useEffect(() => {
    if (!showAccessControls) {
      setHoursEnabled(false);
      setValues((v) => ({ ...v, allowed_days: "all" }));
    }
  }, [showAccessControls]);

  // Derived state for custom day picker
  const daysMode =
    values.allowed_days === "all" ||
    values.allowed_days === "weekdays" ||
    values.allowed_days === "weekends"
      ? values.allowed_days
      : "custom";

  const customDays = parseCustomDays(values.allowed_days ?? "");

  function setDaysMode(mode: "all" | "weekdays" | "weekends" | "custom") {
    if (mode === "custom") {
      update("allowed_days", "custom:Mon,Tue,Wed,Thu,Fri");
    } else {
      update("allowed_days", mode);
    }
  }

  function toggleCustomDay(day: Day) {
    const current = customDays.includes(day)
      ? customDays.filter((d) => d !== day)
      : [...customDays, day];
    const ordered = DAY_OPTIONS.filter((d) => current.includes(d));
    update("allowed_days", ordered.length ? `custom:${ordered.join(",")}` : "custom:");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editing
        ? `/api/contractors/${contractorId}`
        : "/api/contractors";
      const method = editing ? "PATCH" : "POST";
      if (!selectedType) {
        throw new Error("Please select a vehicle type.");
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          role: selectedType,
          allowed_days: showAccessControls ? values.allowed_days : "all",
          allowed_hours: showAccessControls && hoursEnabled ? `${hoursStart}-${hoursEnd}` : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save");
      }
      router.push("/vehicles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Delete this vehicle and all its session history?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractors/${contractorId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/vehicles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSubmitting(false);
    }
  }

  function update<K extends keyof ContractorFormValues>(
    key: K,
    val: ContractorFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{editing ? "Edit vehicle" : "New vehicle"}</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          {/* Core fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                required
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Alex Gardener"
              />
            </Field>
            <Field label="Type">
              <Select
                required
                className="font-medium"
                value={selectedType}
                onChange={(e) => update("role", e.target.value)}
              >
                <option value="" disabled>
                  Select..
                </option>
                {TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vehicle reg" hint="Stored uppercase, no spaces.">
              <Input
                required
                value={values.vehicle_reg}
                onChange={(e) =>
                  update("vehicle_reg", e.target.value.toUpperCase())
                }
                placeholder="AB12CDE"
              />
            </Field>
            {editing ? (
              <Field label="Status">
                <Select
                  className="font-medium"
                  value={values.active ?? 1}
                  onChange={(e) => update("active", Number(e.target.value))}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </Select>
              </Field>
            ) : (
              <div className="hidden sm:block" aria-hidden />
            )}
            <Field label="Email">
              <Input
                type="email"
                value={values.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={values.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={values.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anything worth remembering."
            />
          </Field>

          {/* Access control */}
          <div
            aria-hidden={!showAccessControls}
            className={clsx(
              "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out",
              showAccessControls
                ? "grid-rows-[1fr] opacity-100 translate-y-0"
                : "grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none"
            )}
          >
            <div className="overflow-hidden">
              <div className="border-t border-[var(--border)] pt-4 space-y-4">
                <p className="text-sm font-medium text-[var(--fg)]">Access control</p>

                <Field
                  label="Allowed hours"
                  hint="Entries outside this timeframe are flagged. Disable for unrestricted access."
                >
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                      <input
                        type="checkbox"
                        checked={hoursEnabled}
                        onChange={(e) => setHoursEnabled(e.target.checked)}
                      />
                      Restrict to specific hours
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2">
                      <Select
                        value={hoursStart}
                        onChange={(e) => setHoursStart(e.target.value)}
                        disabled={!hoursEnabled}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </Select>
                      <div className="text-sm text-[var(--fg-muted)] self-center text-center">to</div>
                      <Select
                        value={hoursEnd}
                        onChange={(e) => setHoursEnd(e.target.value)}
                        disabled={!hoursEnabled}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </Field>

                <Field label="Allowed days">
                  <div className="space-y-2">
                    <Select
                      className="font-medium"
                      value={daysMode}
                      onChange={(e) =>
                        setDaysMode(
                          e.target.value as "all" | "weekdays" | "weekends" | "custom"
                        )
                      }
                    >
                      <option value="all">Everyday</option>
                      <option value="weekdays">Weekdays (Mon–Fri)</option>
                      <option value="weekends">Weekends (Sat–Sun)</option>
                      <option value="custom">Specific Days…</option>
                    </Select>

                    {daysMode === "custom" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {DAY_OPTIONS.map((day) => {
                          const active = customDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleCustomDay(day)}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                active
                                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                  : "bg-[var(--bg-elevated)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--accent)]"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {error ? (
            <div className="text-sm text-[var(--danger)]">{error}</div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 gap-2">
            <div>
              {editing ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={remove}
                  disabled={submitting}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/vehicles")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Create vehicle"}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
