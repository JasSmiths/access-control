"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ExpandModal } from "@/components/ui/ExpandModal";
import { Field, Input } from "@/components/ui/Input";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";

type LogRow = {
  id: number;
  occurred_at: string;
  level: "info" | "warn" | "error";
  category: string;
  action: string;
  message: string;
  ip: string | null;
  method: string | null;
  path: string | null;
  actor: string | null;
  contractor_id: number | null;
  plate: string | null;
  device_id: string | null;
  device_name: string | null;
  event_id: string | null;
  details_json: string | null;
};

type DetailItem = {
  label: string;
  value: string;
};

type FieldChangeItem = {
  field: string;
  before: unknown;
  after: unknown;
};

type ParsedDetails =
  | { kind: "empty" }
  | { kind: "changes"; items: FieldChangeItem[] }
  | { kind: "event_meta"; rows: Array<{ eventId: string; type: string; source: string }> }
  | { kind: "items"; items: DetailItem[] }
  | { kind: "raw"; raw: string };

export function LiveLogs({ initial }: { initial: LogRow[] }) {
  const [rows, setRows] = useState<LogRow[]>(initial);
  const [connected, setConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);
  const [editingDevice, setEditingDevice] = useState<{ id: string; current: string } | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "err">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/logs?limit=200", { cache: "no-store" });
      if (!r.ok) return;
      const payload = (await r.json()) as { rows: LogRow[] };
      setRows(payload.rows);
    } catch {
      // ignore
    }
  }, []);

  const probeLatency = useCallback(async () => {
    const started = performance.now();
    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("health failed");
      setLatencyMs(Math.max(1, Math.round(performance.now() - started)));
    } catch {
      setLatencyMs(null);
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const onAny = () => refresh();
    es.addEventListener("session.opened", onAny);
    es.addEventListener("session.closed", onAny);
    es.addEventListener("session.flagged", onAny);
    es.addEventListener("contractor.updated", onAny);
    es.addEventListener("log.created", onAny);
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    void probeLatency();
    const id = window.setInterval(() => void probeLatency(), 15000);
    return () => window.clearInterval(id);
  }, [probeLatency]);

  const hasRows = rows.length > 0;
  const parsedDetails = useMemo(
    () => parseDetailsJson(selectedLog?.details_json ?? null),
    [selectedLog?.details_json]
  );

  function startEditDevice(row: LogRow) {
    if (!row.device_id) return;
    setEditingDevice({ id: row.device_id, current: row.device_name ?? "" });
    setDeviceName(row.device_name ?? "");
    setSaveState("idle");
    setSaveError(null);
  }

  async function saveDeviceName() {
    if (!editingDevice) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/log-devices/${encodeURIComponent(editingDevice.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deviceName }),
      });
      if (!res.ok) {
        setSaveState("err");
        setSaveError((await res.text()) || "Failed to save");
        return;
      }
      setSaveState("idle");
      setEditingDevice(null);
      await refresh();
    } catch {
      setSaveState("err");
      setSaveError("Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Live operational audit log for webhooks, auth, API calls, and session actions.
          </p>
        </div>
        <Badge tone={connected ? "success" : "neutral"}>
          {connected
            ? latencyMs == null
              ? "Live"
              : `Live - ${latencyMs}ms`
            : "Offline"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {!hasRows ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No logs yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Level</TH>
                  <TH>Action</TH>
                  <TH>Message</TH>
                  <TH>Device</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((row) => (
                  <TR
                    key={row.id}
                    onClick={() => setSelectedLog(row)}
                    className="cursor-pointer"
                  >
                    <TD className="whitespace-nowrap">{formatDateTime(row.occurred_at)}</TD>
                    <TD>
                      <Badge
                        tone={
                          row.level === "error"
                            ? "danger"
                            : row.level === "warn"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {row.level}
                      </Badge>
                    </TD>
                    <TD className="font-mono text-xs">{row.action}</TD>
                    <TD className="max-w-[26rem] truncate" title={row.message}>{row.message}</TD>
                    <TD>
                      {row.device_id ? (
                        <button
                          type="button"
                          className="text-left text-xs hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditDevice(row);
                          }}
                        >
                          {row.device_name ? `${row.device_name} (${row.device_id})` : row.device_id}
                        </button>
                      ) : (
                        "—"
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <ExpandModal
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Log Details"
      >
        {selectedLog ? (
          <dl className="space-y-3 text-sm">
            <DetailRow label="When">{formatDateTime(selectedLog.occurred_at)}</DetailRow>
            <DetailRow label="Level">
              <Badge
                tone={
                  selectedLog.level === "error"
                    ? "danger"
                    : selectedLog.level === "warn"
                      ? "warning"
                      : "neutral"
                }
              >
                {selectedLog.level}
              </Badge>
            </DetailRow>
            <DetailRow label="Category">{selectedLog.category}</DetailRow>
            <DetailRow label="Action">
              <span className="font-mono text-xs">{selectedLog.action}</span>
            </DetailRow>
            <DetailRow label="Message">{selectedLog.message}</DetailRow>
            <DetailRow label="IP">
              <span className="font-mono text-xs">{selectedLog.ip ?? "—"}</span>
            </DetailRow>
            <DetailRow label="Method">{selectedLog.method ?? "—"}</DetailRow>
            <DetailRow label="Path">
              <span className="font-mono text-xs">{selectedLog.path ?? "—"}</span>
            </DetailRow>
            <DetailRow label="User">{selectedLog.actor ?? "—"}</DetailRow>
            <DetailRow label="Plate">
              <span className="font-mono text-xs">{selectedLog.plate ?? "—"}</span>
            </DetailRow>
            <DetailRow label="Device">
              {selectedLog.device_id ? (
                <button
                  type="button"
                  className="text-left text-xs hover:underline"
                  onClick={() => {
                    setSelectedLog(null);
                    startEditDevice(selectedLog);
                  }}
                >
                  {selectedLog.device_name
                    ? `${selectedLog.device_name} (${selectedLog.device_id})`
                    : selectedLog.device_id}
                </button>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Event ID">
              <span className="font-mono text-xs break-all">{selectedLog.event_id ?? "—"}</span>
            </DetailRow>
            <DetailRow label="Details">
              {parsedDetails.kind === "empty" ? (
                <span className="text-[var(--fg-muted)]">—</span>
              ) : parsedDetails.kind === "changes" ? (
                parsedDetails.items.length === 0 ? (
                  <span className="text-[var(--fg-muted)]">No field values changed.</span>
                ) : (
                  <div className="overflow-hidden rounded-lg border bg-[var(--bg)]">
                    <Table className="text-xs [&>tbody>tr:hover]:bg-transparent">
                      <THead>
                        <TR>
                          <TH>Updated</TH>
                          <TH>Before</TH>
                          <TH>After</TH>
                        </TR>
                      </THead>
                      <tbody>
                        {parsedDetails.items.map((item) => (
                          <TR
                            key={`${item.field}:${stringifyDetailValue(item.before)}:${stringifyDetailValue(item.after)}`}
                          >
                            <TD className="text-[var(--fg-muted)]">
                              {formatDetailLabel(item.field)}
                            </TD>
                            <TD className="font-mono text-[var(--fg)] break-all">
                              {stringifyDetailValue(item.before)}
                            </TD>
                            <TD className="font-mono text-[var(--fg)] break-all">
                              {stringifyDetailValue(item.after)}
                            </TD>
                          </TR>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )
              ) : parsedDetails.kind === "items" ? (
                <div className="overflow-hidden rounded-lg border bg-[var(--bg)]">
                  <Table className="text-xs [&>tbody>tr:hover]:bg-transparent">
                    <THead>
                      <TR>
                        <TH>Updated</TH>
                        <TH>Value</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {parsedDetails.items.map((item) => (
                        <TR key={`${item.label}:${item.value}`}>
                          <TD className="text-[var(--fg-muted)]">{item.label}</TD>
                          <TD className="font-mono text-[var(--fg)] break-all">{item.value}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : parsedDetails.kind === "event_meta" ? (
                <div className="overflow-hidden rounded-lg border bg-[var(--bg)]">
                  <Table className="text-xs [&>tbody>tr:hover]:bg-transparent">
                    <THead>
                      <TR>
                        <TH>Event ID</TH>
                        <TH>Type</TH>
                        <TH>Source</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {parsedDetails.rows.map((row, index) => (
                        <TR key={`${row.eventId}:${row.type}:${row.source}:${index}`}>
                          <TD className="font-mono text-[var(--fg)] break-all">{row.eventId}</TD>
                          <TD className="font-mono text-[var(--fg)] break-all">{row.type}</TD>
                          <TD className="font-mono text-[var(--fg)] break-all">{row.source}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <pre className="rounded-lg border bg-[var(--bg)] p-3 text-xs whitespace-pre-wrap break-all text-[var(--fg-muted)]">
                  {parsedDetails.raw}
                </pre>
              )}
            </DetailRow>
          </dl>
        ) : null}
      </ExpandModal>

      <ExpandModal
        open={editingDevice !== null}
        onClose={() => setEditingDevice(null)}
        title="Name Device"
      >
        {editingDevice ? (
          <div className="space-y-4">
            <Field label="Device ID">
              <Input readOnly value={editingDevice.id} />
            </Field>
            <Field label="Friendly name">
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Front Gate Camera"
              />
            </Field>
            {saveError ? <p className="text-sm text-[var(--danger)]">{saveError}</p> : null}
            <Button type="button" onClick={saveDeviceName} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving…" : "Save name"}
            </Button>
          </div>
        ) : null}
      </ExpandModal>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <dt className="w-24 shrink-0 font-medium text-[var(--fg-muted)]">{label}</dt>
      <dd className="text-[var(--fg)] min-w-0">{children}</dd>
    </div>
  );
}

function parseDetailsJson(raw: string | null): ParsedDetails {
  if (!raw) return { kind: "empty" };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const source = firstString(obj.source, obj.via, obj.origin) ?? "—";
      const eventId =
        firstString(obj.event_id, obj.eventId, obj.id) ??
        firstString((obj.event as Record<string, unknown> | undefined)?.id) ??
        "—";
      const emittedRaw = obj.emitted ?? obj.type;
      const emittedList = normalizeToStringList(emittedRaw);
      if (source !== "—" || eventId !== "—" || emittedList.length > 0) {
        const rows =
          emittedList.length > 0
            ? emittedList.map((type) => ({ eventId, type, source }))
            : [{ eventId, type: "—", source }];
        return { kind: "event_meta", rows };
      }
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { changes?: unknown }).changes)
    ) {
      const changesRaw = (parsed as { changes: unknown[] }).changes;
      const changes = changesRaw
        .filter((entry): entry is { field?: unknown; before?: unknown; after?: unknown } =>
          !!entry && typeof entry === "object"
        )
        .map((entry) => ({
          field: String(entry.field ?? "value"),
          before: entry.before,
          after: entry.after,
        }))
        .filter((entry) => !isSameValue(entry.before, entry.after));
      return { kind: "changes", items: changes };
    }

    const flat = flattenDetails(parsed);
    return {
      kind: "items",
      items: flat.map((item) => ({
        label: formatDetailLabel(item.path),
        value: stringifyDetailValue(item.value),
      })),
    };
  } catch {
    return { kind: "raw", raw };
  }
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return null;
}

function normalizeToStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => firstString(item))
      .filter((item): item is string => !!item);
  }
  const single = firstString(value);
  return single ? [single] : [];
}

function flattenDetails(value: unknown, path = ""): Array<{ path: string; value: unknown }> {
  if (value === null || typeof value !== "object") {
    return [{ path: path || "value", value }];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [{ path: path || "value", value: "[]" }];
    const hasNestedObjects = value.some((item) => item !== null && typeof item === "object");
    if (!hasNestedObjects) {
      return [{ path: path || "value", value }];
    }
    return value.flatMap((item, index) =>
      flattenDetails(item, `${path || "value"}[${index + 1}]`)
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return [{ path: path || "value", value: "{}" }];

  return entries.flatMap(([key, nested]) =>
    flattenDetails(nested, path ? `${path}.${key}` : key)
  );
}

function stringifyDetailValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => stringifyDetailValue(item)).join(", ");
  }
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isSameValue(a: unknown, b: unknown): boolean {
  return stringifyComparable(a) === stringifyComparable(b);
}

function stringifyComparable(value: unknown): string {
  if (value === undefined) return "__undefined__";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatDetailLabel(path: string): string {
  const labelAliases: Record<string, string> = {
    emitted: "Type",
  };
  const segments = path.split(".");
  return segments
    .map((segment) => {
      const match = /^([^\[]+)(\[\d+\])?$/.exec(segment);
      const base = match?.[1] ?? segment;
      const index = match?.[2] ?? "";
      const spaced = base
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
      const title = spaced
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ");
      const normalized = title
        .replace(/\bId\b/g, "ID")
        .replace(/\bIp\b/g, "IP")
        .replace(/\bApi\b/g, "API")
        .replace(/\bUrl\b/g, "URL");
      const alias = labelAliases[base.toLowerCase()];
      return `${alias ?? normalized}${index}`;
    })
    .join(" > ");
}
