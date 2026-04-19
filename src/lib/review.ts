export const REVIEW_REASON_OPTIONS = [
  "Duplicate Detection",
  "Misread Plate",
  "Maintenance",
  "Other",
] as const;

export type ReviewReason = (typeof REVIEW_REASON_OPTIONS)[number];

export type FlaggedSessionRow = {
  id: number;
  contractor_id: number;
  contractor_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  review_reason: ReviewReason | null;
  review_note: string | null;
  reviewed_at: string | null;
};

export function isReviewReason(value: unknown): value is ReviewReason {
  return (
    typeof value === "string" &&
    (REVIEW_REASON_OPTIONS as readonly string[]).includes(value)
  );
}
