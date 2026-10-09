/** Dates are `YYYY-MM-DD` strings, so lexical comparison is chronological. */
export function isWithinPeriod(
  date: string | null | undefined,
  start: string,
  end: string,
): boolean {
  if (!date) return true;
  return date >= start && date <= end;
}

/** Next calendar day for a `YYYY-MM-DD` string, timezone independent. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Whether `date` is strictly after `today` (both `YYYY-MM-DD`, lexical = chronological). */
export function isFutureDate(date: string, today: string): boolean {
  return date > today;
}
