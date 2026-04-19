import { clsx } from "@/components/ui/clsx";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
};

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "inline-flex items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={clsx("h-5 w-5", iconClassName)}
      >
        <path d="M3.5 10.2L12 3.5l8.5 6.7" />
        <path d="M6 9.8V20h12V9.8" />
        <path d="M9.4 20v-5.3c0-1.4 1.1-2.5 2.5-2.5h.2c1.4 0 2.5 1.1 2.5 2.5V20" />
        <rect x="10.5" y="15.2" width="3" height="2.6" rx="0.6" />
        <path d="M12 16.2v1.1" />
      </svg>
    </div>
  );
}
