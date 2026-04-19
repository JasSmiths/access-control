"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Download, Eye } from "lucide-react";
import { REPORT_FILENAME_PREFIX } from "@/lib/brand";

type Contractor = { id: number; name: string };

export function ReportForm({ contractors }: { contractors: Contractor[] }) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "custom">("day");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [contractorId, setContractorId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  function buildBody() {
    const body: Record<string, unknown> = { period };
    if (period === "custom") {
      body.from = from;
      body.to = to;
    }
    if (contractorId) body.contractorId = Number(contractorId);
    return body;
  }

  async function fetchPdf(): Promise<Blob | null> {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  }

  async function preview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const blob = await fetchPdf();
      if (!blob) return;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function download(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const blob = await fetchPdf();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${REPORT_FILENAME_PREFIX}-${period}-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Generate a PDF report</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-4">
            <Field label="Period">
              <select
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as "day" | "week" | "month" | "custom")
                }
                className="block w-full rounded-lg border bg-[var(--bg-elevated)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="day">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="custom">Custom range</option>
              </select>
            </Field>
            {period === "custom" ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From">
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    required
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Contractor" hint="Leave blank for all contractors.">
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="block w-full rounded-lg border bg-[var(--bg-elevated)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">All contractors</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {error ? (
              <div className="text-sm text-[var(--danger)]">{error}</div>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="secondary"
                disabled={submitting}
                onClick={preview}
              >
                <Eye size={15} />
                {submitting ? "Building…" : "Preview"}
              </Button>
              <Button type="submit" disabled={submitting} onClick={download}>
                <Download size={15} />
                Download
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Inline PDF viewer */}
      {pdfUrl && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--fg)]">Preview</span>
            <button
              type="button"
              onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }}
              className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              Close
            </button>
          </div>
          <iframe
            src={pdfUrl}
            className="w-full"
            style={{ height: "80vh" }}
            title="Report preview"
          />
        </div>
      )}
    </div>
  );
}
