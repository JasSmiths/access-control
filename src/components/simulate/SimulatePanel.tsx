"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input } from "@/components/ui/Input";
import { LogIn, LogOut, Zap, Wifi } from "lucide-react";

type Contractor = { id: number; name: string; vehicle_reg: string; role: string | null };
type WebhookTest = {
  id: number;
  device: string;
  source: string;
  occurred_at: string;
  received_at: string;
};

type Result = {
  ok: boolean;
  event?: "enter" | "exit";
  contractorName?: string;
  eventId?: number;
  emitted?: string[];
  error?: string;
  occurred_at?: string;
};

type WebhookSimResult = {
  ok: boolean;
  status?: number;
  mode?: "single" | "misread_burst";
  requested_plate?: string;
  correct_plate_position?: number;
  sequence?: Array<{
    index: number;
    plate: string;
    event_id: string;
    delay_ms: number;
    status: number;
    ok: boolean;
  }>;
  webhook_response?: unknown;
  error?: string;
};

export function SimulatePanel({
  contractors,
  webhookTests,
}: {
  contractors: Contractor[];
  webhookTests: WebhookTest[];
}) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [customPlate, setCustomPlate] = useState("");
  const [customEvent, setCustomEvent] = useState<"enter" | "exit">("enter");
  const [customResult, setCustomResult] = useState<Result | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [webhookPlate, setWebhookPlate] = useState("SVA673");
  const [webhookLoadingMode, setWebhookLoadingMode] = useState<"single" | "misread_burst" | null>(null);
  const [webhookResult, setWebhookResult] = useState<WebhookSimResult | null>(null);

  async function fire(plate: string, event: "enter" | "exit", key: string) {
    setLoading(key);
    try {
      const res = await fetch(
        `/api/simulate?plate=${encodeURIComponent(plate)}&event=${event}&source=ui`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setResults((r) => ({
        ...r,
        [key]: {
          ok: res.ok,
          event,
          contractorName: json.contractor?.name,
          eventId: json.event_id,
          emitted: json.emitted,
          error: json.error,
          occurred_at: json.occurred_at,
        },
      }));
    } catch (err) {
      setResults((r) => ({
        ...r,
        [key]: { ok: false, error: String(err) },
      }));
    } finally {
      setLoading(null);
    }
  }

  async function fireCustom() {
    const plate = customPlate.trim().toUpperCase();
    if (!plate) return;
    setCustomLoading(true);
    setCustomResult(null);
    try {
      const res = await fetch(
        `/api/simulate?plate=${encodeURIComponent(plate)}&event=${customEvent}&source=ui-custom`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setCustomResult({
        ok: res.ok,
        event: customEvent,
        contractorName: json.contractor?.name,
        eventId: json.event_id,
        emitted: json.emitted,
        error: json.error,
        occurred_at: json.occurred_at,
      });
    } catch (err) {
      setCustomResult({ ok: false, error: String(err) });
    } finally {
      setCustomLoading(false);
    }
  }

  async function fireWebhookSample(mode: "single" | "misread_burst") {
    const plate = webhookPlate.trim().toUpperCase();
    if (!plate) return;
    setWebhookLoadingMode(mode);
    setWebhookResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, plate }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        status?: number;
        mode?: "single" | "misread_burst";
        requested_plate?: string;
        correct_plate_position?: number;
        sequence?: Array<{
          index: number;
          plate: string;
          event_id: string;
          delay_ms: number;
          status: number;
          ok: boolean;
        }>;
        webhook_response?: unknown;
        error?: string;
      };
      setWebhookResult({
        ok: !!payload.ok,
        status: payload.status ?? res.status,
        mode: payload.mode,
        requested_plate: payload.requested_plate,
        correct_plate_position: payload.correct_plate_position,
        sequence: payload.sequence,
        webhook_response: payload.webhook_response,
        error: payload.error,
      });
    } catch (err) {
      setWebhookResult({ ok: false, error: String(err) });
    } finally {
      setWebhookLoadingMode(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Contractor grid */}
      {contractors.length === 0 ? (
        <div className="text-sm text-[var(--fg-muted)]">
          No active contractors. Add one first.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractors.map((c) => {
            const enterKey = `${c.id}-enter`;
            const exitKey = `${c.id}-exit`;
            const lastResult = results[exitKey] ?? results[enterKey];
            const busy = loading === enterKey || loading === exitKey;

            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{c.name}</CardTitle>
                      {c.role && (
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{c.role}</p>
                      )}
                    </div>
                    <code className="shrink-0 text-xs font-mono bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                      {c.vehicle_reg}
                    </code>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => fire(c.vehicle_reg, "enter", enterKey)}
                      className="flex-1"
                    >
                      <LogIn size={14} />
                      Enter
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => fire(c.vehicle_reg, "exit", exitKey)}
                      className="flex-1"
                    >
                      <LogOut size={14} />
                      Exit
                    </Button>
                  </div>

                  {lastResult && (
                    <ResultBadge result={lastResult} />
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Custom plate */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Custom plate</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Plate">
                <Input
                  value={customPlate}
                  onChange={(e) => setCustomPlate(e.target.value.toUpperCase())}
                  placeholder="AB12CDE"
                  className="font-mono"
                />
              </Field>
            </div>
            <Field label="Event">
              <select
                value={customEvent}
                onChange={(e) => setCustomEvent(e.target.value as "enter" | "exit")}
                className="block w-full rounded-lg border bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="enter">enter</option>
                <option value="exit">exit</option>
              </select>
            </Field>
          </div>
          <Button
            onClick={fireCustom}
            disabled={customLoading || !customPlate.trim()}
          >
            <Zap size={14} />
            {customLoading ? "Firing…" : "Fire event"}
          </Button>
          {customResult && <ResultBadge result={customResult} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook sample (Home Assistant LPR)</CardTitle>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            Sends UniFi/Home Assistant-style JSON payloads through{" "}
            <code className="font-mono">/api/webhooks/gate</code> to validate full webhook capture and burst handling.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Registration plate">
            <Input
              value={webhookPlate}
              onChange={(e) => setWebhookPlate(e.target.value.toUpperCase())}
              placeholder="SVA673"
              className="font-mono"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void fireWebhookSample("single")}
              disabled={webhookLoadingMode !== null || !webhookPlate.trim()}
            >
              <Wifi size={14} />
              {webhookLoadingMode === "single" ? "Sending webhook…" : "Simulate LPR webhook"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void fireWebhookSample("misread_burst")}
              disabled={webhookLoadingMode !== null || !webhookPlate.trim()}
            >
              <Zap size={14} />
              {webhookLoadingMode === "misread_burst"
                ? "Sending burst…"
                : "Simulate Misread Burst (3s)"}
            </Button>
          </div>

          {webhookResult ? (
            webhookResult.ok ? (
              <div className="rounded-lg bg-[var(--success)]/8 border border-[var(--success)]/30 px-3 py-2 text-xs space-y-1">
                <div className="text-[var(--success)] font-medium">
                  Webhook accepted ({webhookResult.status ?? 200})
                </div>
                {webhookResult.mode === "misread_burst" && webhookResult.sequence ? (
                  <div className="space-y-1 text-[var(--fg-muted)]">
                    <div>
                      Correct plate{" "}
                      <code className="font-mono">{webhookResult.requested_plate}</code> sent at webhook{" "}
                      #{webhookResult.correct_plate_position ?? "?"}.
                    </div>
                    <div>
                      Sequence:{" "}
                      {webhookResult.sequence
                        .map((item) => `${item.index}:${item.plate}`)
                        .join(" • ")}
                    </div>
                  </div>
                ) : null}
                <pre className="rounded border bg-[var(--bg)] p-2 text-[11px] whitespace-pre-wrap break-all text-[var(--fg-muted)]">
                  {formatJson(webhookResult.webhook_response)}
                </pre>
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--danger)]/8 border border-[var(--danger)]/30 px-3 py-2 text-xs space-y-1">
                <div className="text-[var(--danger)] font-medium">
                  Webhook failed ({webhookResult.status ?? "error"})
                </div>
                {webhookResult.error ? <div>{webhookResult.error}</div> : null}
                {webhookResult.webhook_response !== undefined ? (
                  <pre className="rounded border bg-[var(--bg)] p-2 text-[11px] whitespace-pre-wrap break-all text-[var(--fg-muted)]">
                    {formatJson(webhookResult.webhook_response)}
                  </pre>
                ) : null}
              </div>
            )
          ) : null}
        </CardBody>
      </Card>

      {/* UniFi test event history */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-[var(--fg-muted)]" />
            <CardTitle>UniFi webhook connectivity</CardTitle>
          </div>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            When UniFi fires a test ping (<code className="font-mono">eventId: testEventId</code>),
            it appears here. Last 10 pings shown.
          </p>
        </CardHeader>
        <CardBody>
          {webhookTests.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">
              No test pings received yet. Send a test event from UniFi Protect to verify connectivity.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fg-muted)] border-b">
                  <th className="pb-2 pr-4 font-medium">Device</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {webhookTests.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-[var(--bg)]"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{t.device}</td>
                    <td className="py-2 pr-4 text-[var(--fg-muted)]">{t.source}</td>
                    <td className="py-2 text-[var(--fg-muted)]">
                      {new Date(t.received_at + "Z").toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ResultBadge({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg bg-[var(--danger)]/8 border border-[var(--danger)]/30 px-3 py-2 text-xs text-[var(--danger)]">
        {result.error ?? "Failed"}
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-[var(--success)]/8 border border-[var(--success)]/30 px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <Badge tone={result.event === "enter" ? "accent" : "neutral"}>
          {result.event}
        </Badge>
        <span className="text-[var(--success)] font-medium">
          event #{result.eventId} ingested
        </span>
      </div>
      {result.emitted && result.emitted.length > 0 && (
        <div className="text-[var(--fg-muted)]">
          emitted: {result.emitted.join(", ")}
        </div>
      )}
      {result.occurred_at && (
        <div className="text-[var(--fg-muted)]">
          at {new Date(result.occurred_at).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
