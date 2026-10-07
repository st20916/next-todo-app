import { addDays } from "@/lib/period";

/** Today's date in the viewer's local timezone as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Monday of the week containing `date` (weeks start on Monday). */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export const sundayOf = (date: string) => addDays(mondayOf(date), 6);
