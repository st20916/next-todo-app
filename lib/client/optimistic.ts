import { STATUSES, type Status, type TodoItem } from "@/lib/client/types";

const byPosition = (a: TodoItem, b: TodoItem) => a.position - b.position;

const column = (todos: TodoItem[], status: Status) => todos.filter((t) => t.status === status).sort(byPosition);

/**
 * Mirrors the server's move semantics on a single day's todos:
 * remove the item, insert at `position` (clamped) in the target column, renumber
 * both affected columns to 0..n-1.
 */
export function applyMove(todos: TodoItem[], id: string, status: Status, position: number): TodoItem[] {
  const moving = todos.find((t) => t.id === id);
  if (!moving) return todos;
  const rest = todos.filter((t) => t.id !== id);

  const target = column(rest, status);
  target.splice(Math.min(Math.max(position, 0), target.length), 0, { ...moving, status });

  const updated = new Map<string, TodoItem>();
  const renumber = (list: TodoItem[]) => list.forEach((t, i) => updated.set(t.id, { ...t, position: i }));
  renumber(target);
  if (moving.status !== status) renumber(column(rest, moving.status));

  return todos.map((t) => updated.get(t.id) ?? t);
}

/** Resolves a dnd-kit drop (over a column or over a card) into a status and index. */
export function dropTarget(
  todos: TodoItem[],
  activeId: string,
  overId: string,
): { status: Status; position: number } | null {
  if (activeId === overId) return null;
  if ((STATUSES as string[]).includes(overId)) {
    const status = overId as Status;
    const length = column(todos, status).filter((t) => t.id !== activeId).length;
    return { status, position: length };
  }
  const over = todos.find((t) => t.id === overId);
  if (!over) return null;
  const index = column(todos, over.status).findIndex((t) => t.id === overId);
  return { status: over.status, position: index };
}
