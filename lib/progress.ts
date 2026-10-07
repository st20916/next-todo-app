export interface Progress {
  done: number;
  total: number;
  percent: number;
}

/** done / total × 100, rounded; 0 when there is nothing to complete. */
export function calcProgress(done: number, total: number): Progress {
  if (total <= 0) return { done: 0, total: 0, percent: 0 };
  return { done, total, percent: Math.round((done / total) * 100) };
}

/**
 * Weighted roll-up: sums todo counts across children instead of averaging
 * their percentages, so a plan with more todos weighs more.
 */
export function aggregateProgress(parts: Array<{ done: number; total: number }>): Progress {
  const done = parts.reduce((sum, p) => sum + p.done, 0);
  const total = parts.reduce((sum, p) => sum + p.total, 0);
  return calcProgress(done, total);
}
