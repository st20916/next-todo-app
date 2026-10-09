/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { call } from "../helpers/http";
import * as todos from "@/app/api/todos/route";
import * as move from "@/app/api/todos/[id]/move/route";
import * as carry from "@/app/api/todos/carry-over/route";
import * as plans from "@/app/api/weekly-plans/route";

setupTestDb();

// Fixture dates below are static ("2026-10-xx"); freeze "today" after all of them so the
// future-date guard (FUTURE_DATE_NOT_ALLOWED) doesn't collide with move/carry-over tests.
beforeAll(() => vi.setSystemTime(new Date("2026-12-01T00:00:00Z")));
afterAll(() => vi.useRealTimers());

const D = "2026-10-06";
const mk = async (title: string, status = "todo", date = D, weeklyPlanId: string | null = null) =>
  (await call(todos.POST, "POST", { title, status, date, weeklyPlanId })).body.id as string;
const column = async (status: string, date = D) =>
  (await call(todos.GET, "GET", undefined, undefined, `?date=${date}&status=${status}`)).body as any[];
const titles = async (status: string, date = D) => (await column(status, date)).map((t) => t.title);

async function expectContiguous(date = D) {
  for (const status of ["todo", "doing", "done"]) {
    const positions = (await column(status, date)).map((t) => t.position);
    expect(positions).toEqual(positions.map((_, i) => i));
  }
}

describe("PATCH /api/todos/:id/move (AC4, AC5)", () => {
  it("changes status across columns and persists it", async () => {
    const a = await mk("a");
    await mk("b");
    const res = await call(move.PATCH, "PATCH", { status: "doing", position: 0 }, a);
    expect(res.status).toBe(200);
    expect(await titles("doing")).toEqual(["a"]);
    expect(await titles("todo")).toEqual(["b"]);
    await expectContiguous();
  });

  it("inserts at the requested position in the target column", async () => {
    await mk("x", "doing");
    await mk("y", "doing");
    const a = await mk("a");
    await call(move.PATCH, "PATCH", { status: "doing", position: 1 }, a);
    expect(await titles("doing")).toEqual(["x", "a", "y"]);
    await expectContiguous();
  });

  it("reorders within a column and keeps the order after re-reading", async () => {
    const a = await mk("a");
    await mk("b");
    await mk("c");
    await call(move.PATCH, "PATCH", { status: "todo", position: 2 }, a);
    expect(await titles("todo")).toEqual(["b", "c", "a"]);
    const c = (await column("todo"))[1].id;
    await call(move.PATCH, "PATCH", { status: "todo", position: 0 }, c);
    expect(await titles("todo")).toEqual(["c", "b", "a"]);
    await expectContiguous();
  });

  it("clamps an oversized position to the bottom", async () => {
    const a = await mk("a");
    await mk("b");
    await call(move.PATCH, "PATCH", { status: "todo", position: 99 }, a);
    expect(await titles("todo")).toEqual(["b", "a"]);
  });

  it("keeps columns contiguous across many random moves", async () => {
    const ids = [await mk("1"), await mk("2"), await mk("3"), await mk("4", "doing"), await mk("5", "done")];
    const statuses = ["todo", "doing", "done"];
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    for (let i = 0; i < 25; i++) {
      await call(move.PATCH, "PATCH", { status: statuses[rnd(3)], position: rnd(4) }, ids[rnd(ids.length)]);
      await expectContiguous();
    }
    expect((await call(todos.GET, "GET")).body).toHaveLength(5);
  });

  it("validates input and unknown ids", async () => {
    const a = await mk("a");
    expect((await call(move.PATCH, "PATCH", { status: "nope", position: 0 }, a)).status).toBe(400);
    expect((await call(move.PATCH, "PATCH", { status: "done", position: 0 }, "64b64b64b64b64b64b64b64b")).status).toBe(404);
  });
});

describe("POST /api/todos/carry-over (AC14)", () => {
  it("moves unfinished todos to the next day and keeps their status", async () => {
    await mk("t");
    await mk("d", "doing");
    await mk("x", "done");
    const res = await call(carry.POST, "POST", { date: D });
    expect(res.body).toMatchObject({ moved: 2, unlinked: 0, nextDate: "2026-10-07" });
    expect(await titles("doing", "2026-10-07")).toEqual(["d"]);
    expect(await titles("todo", "2026-10-07")).toEqual(["t"]);
    expect(await titles("done", D)).toEqual(["x"]);
    expect(await titles("todo", D)).toEqual([]);
    await expectContiguous(D);
    await expectContiguous("2026-10-07");
  });

  it("appends to the bottom of the next day's column", async () => {
    await mk("existing", "todo", "2026-10-07");
    await mk("carried");
    await call(carry.POST, "POST", { date: D });
    expect(await titles("todo", "2026-10-07")).toEqual(["existing", "carried"]);
  });

  it("is idempotent: a second call moves nothing", async () => {
    await mk("a");
    expect((await call(carry.POST, "POST", { date: D })).body.moved).toBe(1);
    const again = await call(carry.POST, "POST", { date: D });
    expect(again.body).toMatchObject({ moved: 0, unlinked: 0 });
    expect(await titles("todo", "2026-10-07")).toEqual(["a"]);
  });

  it("unlinks todos whose next day leaves the weekly plan period", async () => {
    const plan = (await call(plans.POST, "POST", { title: "W", startDate: "2026-10-05", endDate: "2026-10-11" })).body.id;
    await mk("edge", "doing", "2026-10-11", plan);
    await mk("inside", "todo", "2026-10-10", plan);
    const edge = await call(carry.POST, "POST", { date: "2026-10-11" });
    expect(edge.body).toMatchObject({ moved: 1, unlinked: 1 });
    const moved = (await column("doing", "2026-10-12"))[0];
    expect(moved).toMatchObject({ title: "edge", status: "doing", weeklyPlanId: null });
    const inside = await call(carry.POST, "POST", { date: "2026-10-10" });
    expect(inside.body).toMatchObject({ moved: 1, unlinked: 0 });
    expect((await column("todo", "2026-10-11"))[0].weeklyPlanId).toBe(plan);
    expect((await call(todos.GET, "GET", undefined, undefined, "?unlinked=true")).body.map((t: any) => t.title)).toEqual(["edge"]);
  });

  it("rejects a missing or invalid date", async () => {
    expect((await call(carry.POST, "POST", {})).status).toBe(400);
    expect((await call(carry.POST, "POST", { date: "2026-13-01" })).status).toBe(400);
  });
});
