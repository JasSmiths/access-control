"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Select, Textarea } from "@/components/ui/Input";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  REVIEW_REASON_OPTIONS,
  type FlaggedSessionRow,
  type ReviewReason,
} from "@/lib/review";

type ReviewTableProps = {
  initialRows: FlaggedSessionRow[];
  todayISO: string;
};

export function ReviewTable({ initialRows, todayISO }: ReviewTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reasonById, setReasonById] = useState<Partial<Record<number, ReviewReason>>>({});
  const [noteById, setNoteById] = useState<Partial<Record<number, string>>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Partial<Record<number, string>>>({});

  const flaggedToday = useMemo(
    () => rows.filter((row) => row.started_at >= todayISO).length,
    [rows, todayISO]
  );

  async function resolveSession(sessionId: number) {
    const reason = reasonById[sessionId];
    const note = (noteById[sessionId] ?? "").trim();

    if (!reason) {
      setErrorById((current) => ({
        ...current,
        [sessionId]: "Select a reason before resolving this session.",
      }));
      return;
    }

    if (reason === "Other" && !note) {
      setErrorById((current) => ({
        ...current,
        [sessionId]: "Add a short explanation when choosing Other.",
      }));
      return;
    }

    setSubmittingId(sessionId);
    setErrorById((current) => ({ ...current, [sessionId]: "" }));

    try {
      const response = await fetch("/api/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          reason,
          note: note || null,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to resolve session");
      }

      setRows((current) => current.filter((row) => row.id !== sessionId));
      setActiveId((current) => (current === sessionId ? null : current));
      setReasonById((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setNoteById((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setErrorById((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [sessionId]:
          error instanceof Error ? error.message : "Failed to resolve session",
      }));
    } finally {
      setSubmittingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-[var(--success)]/30 bg-green-500/8 px-4 py-3 text-sm text-[var(--success)]">
          All flagged sessions have been reviewed.
        </div>
        <div className="p-6 text-sm text-[var(--fg-muted)] flex items-center gap-2">
          <span className="text-[var(--success)]">✓</span>
          No flagged sessions. All clear.
        </div>
      </>
    );
  }

  return (
    <>
      {flaggedToday > 0 && (
        <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 px-4 py-3 text-sm text-[var(--warning)]">
          {flaggedToday} item{flaggedToday !== 1 ? "s" : ""} flagged today.
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>Contractor</TH>
            <TH>Started</TH>
            <TH>Ended</TH>
            <TH>Duration</TH>
            <TH>Reason</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <tbody>
          {rows.map((row) => {
            const isToday = row.started_at >= todayISO;
            const reason = reasonById[row.id] ?? "";
            const note = noteById[row.id] ?? "";
            const isOpen = activeId === row.id;
            const isSubmitting = submittingId === row.id;
            const error = errorById[row.id];

            return (
              <FragmentRow key={row.id}>
                <TR>
                  <TD className="font-medium">
                    <Link
                      href={`/vehicles/${row.contractor_id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {row.contractor_name}
                    </Link>
                  </TD>
                  <TD className="text-[var(--fg-muted)]">
                    <span className="flex items-center gap-1.5">
                      {formatDateTime(row.started_at)}
                      {isToday ? (
                        <Badge tone="warning" className="text-xs">
                          Today
                        </Badge>
                      ) : null}
                    </span>
                  </TD>
                  <TD className="text-[var(--fg-muted)]">
                    {row.ended_at ? formatDateTime(row.ended_at) : "—"}
                  </TD>
                  <TD className="tabular-nums text-[var(--fg-muted)]">
                    {row.duration_seconds != null ? formatDuration(row.duration_seconds) : "—"}
                  </TD>
                  <TD>
                    <span className="text-xs text-[var(--warning)]">
                      {row.notes ?? "flagged"}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant={isOpen ? "secondary" : "primary"}
                      size="sm"
                      type="button"
                      onClick={() => setActiveId((current) => (current === row.id ? null : row.id))}
                    >
                      {isOpen ? "Cancel" : "Resolve"}
                    </Button>
                  </TD>
                </TR>

                {isOpen ? (
                  <TR>
                    <TD colSpan={6} className="bg-[var(--bg)]/50">
                      <div className="grid gap-4 p-2 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] md:items-start">
                        <Field label="Issue reason" htmlFor={`review-reason-${row.id}`}>
                          <Select
                            id={`review-reason-${row.id}`}
                            value={reason}
                            onChange={(event) =>
                              setReasonById((current) => ({
                                ...current,
                                [row.id]: event.target.value as ReviewReason,
                              }))
                            }
                          >
                            <option value="">Select a reason</option>
                            {REVIEW_REASON_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field
                          label={reason === "Other" ? "Explain the issue" : "Notes"}
                          htmlFor={`review-note-${row.id}`}
                          hint={
                            reason === "Other"
                              ? "Required when Other is selected."
                              : "Optional context for the review record."
                          }
                        >
                          <Textarea
                            id={`review-note-${row.id}`}
                            value={note}
                            required={reason === "Other"}
                            placeholder={
                              reason === "Other"
                                ? "Describe what needs attention."
                                : "Add any useful review notes."
                            }
                            onChange={(event) =>
                              setNoteById((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))
                            }
                          />
                        </Field>

                        <Button
                          type="button"
                          onClick={() => resolveSession(row.id)}
                          disabled={isSubmitting}
                          className="md:self-start"
                        >
                          {isSubmitting ? "Resolving..." : "Confirm resolution"}
                        </Button>
                      </div>

                      {error ? (
                        <p className="px-2 pb-2 text-sm text-[var(--danger)]">{error}</p>
                      ) : null}
                    </TD>
                  </TR>
                ) : null}
              </FragmentRow>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
