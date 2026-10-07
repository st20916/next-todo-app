import { STATUSES, type Status } from "@/lib/client/types";

export interface TodoFilters {
  status?: Status;
  from?: string;
  to?: string;
  yearGoalId?: string;
  unlinked?: boolean;
}

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v?: string) => !!v && /^[a-f\d]{24}$/i.test(v);

/** Reads URL query params into filters, silently dropping invalid values. */
export function parseTodoFilters(params: Raw): TodoFilters {
  const status = first(params.status);
  const from = first(params.from);
  const to = first(params.to);
  const yearGoalId = first(params.yearGoalId);
  const filters: TodoFilters = {};
  if (status && (STATUSES as string[]).includes(status)) filters.status = status as Status;
  if (isDate(from)) filters.from = from;
  if (isDate(to)) filters.to = to;
  if (isId(yearGoalId)) filters.yearGoalId = yearGoalId;
  if (first(params.unlinked) === "true") filters.unlinked = true;
  return filters;
}

/** Builds the API query string (also used for the page URL); empty when no filter is set. */
export function filtersToQuery(filters: TodoFilters): string {
  const q = new URLSearchParams();
  if (filters.status) q.set("status", filters.status);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.unlinked) q.set("unlinked", "true");
  else if (filters.yearGoalId) q.set("yearGoalId", filters.yearGoalId);
  const s = q.toString();
  return s ? `?${s}` : "";
}
