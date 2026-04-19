import { clsx } from "./clsx";

export function Table({
  className,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        {...rest}
        className={clsx(
          "w-full text-sm border-collapse [&>tbody>tr]:transition-colors [&>tbody>tr:hover]:bg-[var(--bg)]",
          className
        )}
      />
    </div>
  );
}

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      {...props}
      className={clsx(
        "bg-[var(--bg)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]",
        props.className
      )}
    />
  );
}

export function TR(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...props}
      className={clsx("border-b last:border-b-0", props.className)}
    />
  );
}

export function TH(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={clsx("px-4 py-2.5 font-medium", props.className)}
    />
  );
}

export function TD(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={clsx("px-4 py-3", props.className)} />;
}
