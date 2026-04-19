import { Card, CardBody } from "./Card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  Icon,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardBody className="flex items-start gap-4">
        {Icon ? (
          <div className="rounded-lg bg-[var(--accent)]/10 p-2.5 text-[var(--accent)]">
            <Icon size={20} />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-[var(--fg)]">
            {value}
          </div>
          {hint ? (
            <div className="mt-0.5 text-xs text-[var(--fg-muted)]">{hint}</div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
