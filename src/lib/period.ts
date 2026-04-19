export type Period = "day" | "week" | "month" | "custom";

/**
 * Resolve a period label into an inclusive [fromISO, toISO] pair.
 * Returns ISO-8601 UTC bounds, suitable for SQL string comparison
 * against our ISO-stored timestamps.
 */
export function resolvePeriod(
  period: Period,
  fromStr?: string,
  toStr?: string,
  now: Date = new Date()
): { fromISO: string; toISO: string; label: string } {
  if (period === "custom") {
    if (!fromStr || !toStr) throw new Error("custom period requires from and to");
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("invalid custom dates");
    }
    // inclusive end-of-day for `to`
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    const fromStart = new Date(from);
    fromStart.setUTCHours(0, 0, 0, 0);
    return {
      fromISO: fromStart.toISOString(),
      toISO: toEnd.toISOString(),
      label: `${fromStart.toISOString().slice(0, 10)} — ${toEnd.toISOString().slice(0, 10)}`,
    };
  }

  const start = new Date(now);
  const end = new Date(now);
  if (period === "day") {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  } else if (period === "week") {
    const dow = start.getUTCDay(); // 0=Sun
    const offsetToMonday = (dow + 6) % 7; // Mon=0
    start.setUTCDate(start.getUTCDate() - offsetToMonday);
    start.setUTCHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    // month
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    end.setUTCHours(23, 59, 59, 999);
  }

  return {
    fromISO: start.toISOString(),
    toISO: end.toISOString(),
    label: `${start.toISOString().slice(0, 10)} — ${end.toISOString().slice(0, 10)}`,
  };
}
