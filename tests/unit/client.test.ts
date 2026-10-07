import { describe, expect, it } from "vitest";
import { applyMove, dropTarget } from "@/lib/client/optimistic";
import { filtersToQuery, parseTodoFilters } from "@/lib/client/filters";
import { mondayOf, sundayOf, todayLocal } from "@/lib/client/dates";
import type { Status, TodoItem } from "@/lib/client/types";

const t = (id: string, status: Status, position: number): TodoItem => ({
  id, title: id, description: "", date: "2026-10-06", status, position, weeklyPlanId: null,
});
const view = (todos: TodoItem[], status: Status) =>
  todos.filter((x) => x.status === status).sort((a, b) => a.position - b.position).map((x) => `${x.id}:${x.position}`);

describe("applyMove (optimistic update mirrors the server)", () => {
  const base = [t("a", "todo", 0), t("b", "todo", 1), t("c", "todo", 2), t("x", "doing", 0)];

  it("moves across columns and renumbers both", () => {
    const next = applyMove(base, "a", "doing", 1);
    expect(view(next, "doing")).toEqual(["x:0", "a:1"]);
    expect(view(next, "todo")).toEqual(["b:0", "c:1"]);
    expect(next.find((x) => x.id === "a")?.status).toBe("doing");
  });

  it("reorders within a column", () => {
    expect(view(applyMove(base, "a", "todo", 2), "todo")).toEqual(["b:0", "c:1", "a:2"]);
    expect(view(applyMove(base, "c", "todo", 0), "todo")).toEqual(["c:0", "a:1", "b:2"]);
  });

  it("clamps out-of-range positions and ignores unknown ids", () => {
    expect(view(applyMove(base, "a", "done", 9), "done")).toEqual(["a:0"]);
    expect(applyMove(base, "nope", "done", 0)).toBe(base);
  });

  it("does not mutate the input", () => {
    const copy = JSON.parse(JSON.stringify(base));
    applyMove(base, "a", "done", 0);
    expect(base).toEqual(copy);
  });
});

describe("dropTarget", () => {
  const todos = [t("a", "todo", 0), t("b", "todo", 1), t("x", "doing", 0), t("y", "doing", 1)];
  it("drop on a column appends to it", () => {
    expect(dropTarget(todos, "a", "doing")).toEqual({ status: "doing", position: 2 });
    expect(dropTarget(todos, "a", "done")).toEqual({ status: "done", position: 0 });
    expect(dropTarget(todos, "a", "todo")).toEqual({ status: "todo", position: 1 });
  });
  it("drop on a card takes that card's slot", () => {
    expect(dropTarget(todos, "a", "y")).toEqual({ status: "doing", position: 1 });
    expect(dropTarget(todos, "b", "a")).toEqual({ status: "todo", position: 0 });
  });
  it("returns null when dropped on itself or an unknown target", () => {
    expect(dropTarget(todos, "a", "a")).toBeNull();
    expect(dropTarget(todos, "a", "zzz")).toBeNull();
  });
});

describe("todo filters in the URL", () => {
  const id = "64b64b64b64b64b64b64b64b";
  it("parses valid params and drops invalid ones", () => {
    expect(parseTodoFilters({ status: "doing", from: "2026-10-01", to: "2026-10-31", yearGoalId: id })).toEqual({
      status: "doing", from: "2026-10-01", to: "2026-10-31", yearGoalId: id,
    });
    expect(parseTodoFilters({ status: "bogus", from: "yesterday", yearGoalId: "x" })).toEqual({});
    expect(parseTodoFilters({ status: ["done", "todo"] })).toEqual({ status: "done" });
    expect(parseTodoFilters({ unlinked: "true" })).toEqual({ unlinked: true });
  });
  it("round-trips through a query string", () => {
    const f = { status: "done" as const, from: "2026-10-01", yearGoalId: id };
    expect(parseTodoFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(filtersToQuery({})).toBe("");
  });
  it("unlinked wins over a goal filter", () => {
    expect(filtersToQuery({ unlinked: true, yearGoalId: id })).toBe("?unlinked=true");
  });
});

describe("date helpers", () => {
  it("formats the local date", () => expect(todayLocal(new Date(2026, 9, 6))).toBe("2026-10-06"));
  it("finds Monday and Sunday of a week", () => {
    expect(mondayOf("2026-10-06")).toBe("2026-10-05"); // Tuesday
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(sundayOf("2026-10-06")).toBe("2026-10-11");
  });
});
