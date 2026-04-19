"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import type { ReportSection, SettingsRow } from "@/lib/settings-shared";
import { DEFAULT_REPORT_SECTIONS } from "@/lib/settings-shared";

function parseInitialSections(settings: SettingsRow): ReportSection[] {
  if (!settings.report_sections) return DEFAULT_REPORT_SECTIONS;
  try {
    return JSON.parse(settings.report_sections) as ReportSection[];
  } catch {
    return DEFAULT_REPORT_SECTIONS;
  }
}

export function ReportDesigner({ initial }: { initial: SettingsRow }) {
  const [sections, setSections] = useState<ReportSection[]>(() =>
    parseInitialSections(initial)
  );
  const [themeColor, setThemeColor] = useState(initial.report_theme_color ?? "#2563eb");
  const [companyName, setCompanyName] = useState(initial.report_company_name ?? "");
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  function moveUp(index: number) {
    if (index === 0) return;
    setSections((s) => {
      const next = [...s];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setState("idle");
  }

  function moveDown(index: number) {
    setSections((s) => {
      if (index === s.length - 1) return s;
      const next = [...s];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setState("idle");
  }

  function toggleEnabled(index: number) {
    setSections((s) =>
      s.map((sec, i) => (i === index ? { ...sec, enabled: !sec.enabled } : sec))
    );
    setState("idle");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_sections: sections,
        report_theme_color: themeColor,
        report_company_name: companyName || null,
      }),
    });
    if (res.ok) {
      setState("ok");
    } else {
      setState("err");
      setError((await res.text()) || "Failed to save");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Report designer</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={save} className="space-y-6">
          {/* Branding */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--fg)]">Branding</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company / site name" hint="Shown in report header.">
                <Input
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setState("idle"); }}
                  placeholder="e.g. Acme Corp"
                />
              </Field>
              <Field label="Theme colour">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => { setThemeColor(e.target.value); setState("idle"); }}
                    className="h-9 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5"
                  />
                  <span className="text-sm font-mono text-[var(--fg-muted)]">
                    {themeColor}
                  </span>
                </div>
              </Field>
            </div>
          </div>

          {/* Section ordering */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--fg)]">
              Sections — drag to reorder, toggle visibility
            </p>
            <div className="space-y-2">
              {sections.map((section, i) => (
                <div
                  key={section.key}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    section.enabled
                      ? "border-[var(--border)] bg-[var(--bg-elevated)]"
                      : "border-[var(--border)]/50 bg-[var(--bg)] opacity-60"
                  }`}
                >
                  {/* Reorder controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="p-0.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === sections.length - 1}
                      className="p-0.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Label */}
                  <span className="flex-1 text-sm font-medium text-[var(--fg)]">
                    {section.label}
                  </span>

                  {/* Toggle visibility */}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(i)}
                    className={`p-1.5 rounded-md transition-colors ${
                      section.enabled
                        ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
                        : "text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
                    }`}
                    aria-label={section.enabled ? "Hide section" : "Show section"}
                  >
                    {section.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="text-sm text-[var(--danger)]">{error}</div>
          ) : null}
          {state === "ok" ? (
            <div className="text-sm text-[var(--success)]">Design saved.</div>
          ) : null}

          <Button type="submit" disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : "Save design"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
