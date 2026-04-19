import { clsx } from "./clsx";

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={clsx(
        "rounded-xl border bg-[var(--bg-elevated)] shadow-sm",
        className
      )}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={clsx("px-5 pt-5 pb-3 border-b", className)}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={clsx(
        "text-base font-semibold tracking-tight text-[var(--fg)]",
        className
      )}
    />
  );
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={clsx("p-5", className)} />;
}
