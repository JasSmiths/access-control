"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Copy } from "lucide-react";

type ApiKeyRow = {
  id: number;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function ApiAccessCard({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "creating" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/integrations/api-keys", { cache: "no-store" });
      if (!res.ok) {
        setState("err");
        setError((await res.text()) || "Failed to load keys");
        return;
      }
      const payload = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(payload.keys);
      setState("idle");
    } catch {
      setState("err");
      setError("Request failed");
    }
  }

  async function createKey() {
    setState("creating");
    setError(null);
    setCreatedToken(null);
    try {
      const res = await fetch("/api/integrations/api-keys", { method: "POST" });
      if (!res.ok) {
        setState("err");
        setError((await res.text()) || "Failed to create key");
        return;
      }
      const payload = (await res.json()) as { token: string };
      setCreatedToken(payload.token);
      await loadKeys();
      setState("idle");
    } catch {
      setState("err");
      setError("Request failed");
    }
  }

  async function deleteKey(id: number) {
    setError(null);
    try {
      const res = await fetch(`/api/integrations/api-keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to delete key");
        return;
      }
      await loadKeys();
    } catch {
      setError("Request failed");
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadKeys();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>API access</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <p className="text-sm text-[var(--fg-muted)]">
          Create API keys for machine-to-machine integrations. Keys are shown once at creation.
        </p>

        <Button
          type="button"
          onClick={createKey}
          disabled={state === "creating" || state === "loading"}
        >
          {state === "creating" ? "Creating…" : "Create API key"}
        </Button>

        {createdToken ? (
          <Field label="New API key (copy now)">
            <div className="flex gap-2">
              <Input readOnly value={createdToken} />
              <Button type="button" variant="secondary" onClick={copyToken}>
                <Copy size={14} /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Field>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Active keys</p>
          {keys.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">No API keys created yet.</p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li key={k.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs">{k.key_prefix}…</div>
                    {!k.revoked_at ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteKey(k.id)}
                      >
                        Delete
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--fg-muted)]">Deleted</span>
                    )}
                  </div>
                  <div className="text-[var(--fg-muted)]">
                    Created {new Date(k.created_at).toLocaleString()}
                    {k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
          <p className="text-sm font-medium">Example: fetch status with curl</p>
          <pre className="overflow-x-auto text-xs text-[var(--fg-muted)]">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${apiBaseUrl}/api/v1/status`}
          </pre>
          <p className="text-sm font-medium">Example response fields</p>
          <pre className="overflow-x-auto text-xs text-[var(--fg-muted)]">
{`{
  "ok": true,
  "generated_at": "2026-04-16T14:02:30.000Z",
  "on_site": 3,
  "open_sessions": [...]
}`}
          </pre>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
