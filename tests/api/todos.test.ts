/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { call } from "../helpers/http";
import * as todos from "@/app/api/todos/route";
import * as todoById from "@/app/api/todos/[id]/route";
import * as plans from "@/app/api/weekly-plans/route";

setupTestDb();

// Fixture dates below are static ("2026-10-xx"/"2026-11-xx"); freeze "today" after all of
// them so the future-date guard (FUTURE_DATE_NOT_ALLOWED) doesn't collide with period tests.
beforeAll(() => vi.setSystemTime(new Date("2026-12-01T00:00:00Z")));
afterAll(() => vi.useRealTimers());

const week = { title: "W41", startDate: "2026-10-05", endDate: "2026-10-11" };
const makePlan = async (extra = {}) => (await call(plans.POST, "POST", { ...week, ...extra })).body.id as string;

describe("POST /api/todos (AC1)", () => {
  it("rejects a missing title with 400 and the error format", async () => {
    const res = await call(todos.POST, "POST", { description: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("rejects invalid JSON", async () => {
    const req = new Request("http://localhost/api/todos", { method: "POST", body: "{nope" });
    const res = await todos.POST(req, undefined as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });

  it("stores status todo by default and appends to the column", async () => {
    const a = await call(todos.POST, "POST", { title: "a", date: "2026-10-06" });
    const b = await call(todos.POST, "POST", { title: "b", date: "2026-10-06" });
    expect(a.status).toBe(201);
    expect(a.body.status).toBe("todo");
    expect([a.body.position, b.body.position]).toEqual([0, 1]);
  });
});

describe("PATCH /api/todos/:id (AC2, AC8)", () => {
  it("updates title, description, date and weeklyPlanId", async () => {
    const plan = await makePlan();
    const t = (await call(todos.POST, "POST", { title: "a", date: "2026-10-05" })).body;
    const res = await call(todoById.PATCH, "PATCH", { title: "b", description: "d", date: "2026-10-07", weeklyPlanId: plan }, t.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "b", description: "d", date: "2026-10-07", weeklyPlanId: plan });
  });

  it("unlinks with weeklyPlanId null", async () => {
    const plan = await makePlan();
    const t = (await call(todos.POST, "POST", { title: "a", date: "2026-10-06", weeklyPlanId: plan })).body;
    const res = await call(todoById.PATCH, "PATCH", { weeklyPlanId: null }, t.id);
    expect(res.body.weeklyPlanId).toBeNull();
  });

  it("returns 404 for unknown and malformed ids", async () => {
    expect((await call(todoById.PATCH, "PATCH", { title: "x" }, "64b64b64b64b64b64b64b64b")).status).toBe(404);
    expect((await call(todoById.GET, "GET", undefined, "not-an-id")).status).toBe(404);
  });
});

describe("period integrity (AC13)", () => {
  it("rejects creating a todo outside the plan period with 400", async () => {
    const plan = await makePlan();
    const res = await call(todos.POST, "POST", { title: "x", date: "2026-10-12", weeklyPlanId: plan });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PERIOD_MISMATCH");
  });

  it("accepts the boundary dates", async () => {
    const plan = await makePlan();
    expect((await call(todos.POST, "POST", { title: "s", date: "2026-10-05", weeklyPlanId: plan })).status).toBe(201);
    expect((await call(todos.POST, "POST", { title: "e", date: "2026-10-11", weeklyPlanId: plan })).status).toBe(201);
  });

  it("rejects linking an existing todo whose date is outside", async () => {
    const plan = await makePlan();
    const t = (await call(todos.POST, "POST", { title: "x", date: "2026-11-01" })).body;
    const res = await call(todoById.PATCH, "PATCH", { weeklyPlanId: plan }, t.id);
    expect(res.status).toBe(400);
  });

  it("rejects moving a linked todo's date outside the plan", async () => {
    const plan = await makePlan();
    const t = (await call(todos.POST, "POST", { title: "x", date: "2026-10-06", weeklyPlanId: plan })).body;
    const res = await call(todoById.PATCH, "PATCH", { date: "2026-10-20" }, t.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PERIOD_MISMATCH");
  });

  it("allows a todo without a date to link (weekly backlog)", async () => {
    const plan = await makePlan();
    const res = await call(todos.POST, "POST", { title: "backlog", weeklyPlanId: plan });
    expect(res.status).toBe(201);
    expect(res.body.date).toBeNull();
  });

  it("404 when the weekly plan does not exist", async () => {
    const res = await call(todos.POST, "POST", { title: "x", weeklyPlanId: "64b64b64b64b64b64b64b64b" });
    expect(res.status).toBe(404);
  });
});

describe("future date is rejected", () => {
  it("rejects creating a todo dated after today", async () => {
    const res = await call(todos.POST, "POST", { title: "x", date: "2026-12-02" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FUTURE_DATE_NOT_ALLOWED");
  });

  it("accepts today and past dates, and no date at all", async () => {
    expect((await call(todos.POST, "POST", { title: "today", date: "2026-12-01" })).status).toBe(201);
    expect((await call(todos.POST, "POST", { title: "past", date: "2026-10-06" })).status).toBe(201);
    expect((await call(todos.POST, "POST", { title: "none" })).status).toBe(201);
  });

  it("rejects moving an existing todo's date into the future", async () => {
    const t = (await call(todos.POST, "POST", { title: "x", date: "2026-10-06" })).body;
    const res = await call(todoById.PATCH, "PATCH", { date: "2026-12-02" }, t.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FUTURE_DATE_NOT_ALLOWED");
  });

  it("does not re-check an unchanged date, even if it has since become future", async () => {
    const t = (await call(todos.POST, "POST", { title: "x", date: "2026-12-01" })).body;
    vi.setSystemTime(new Date("2026-11-25T00:00:00Z")); // "now" moved earlier than the stored date
    const res = await call(todoById.PATCH, "PATCH", { title: "renamed" }, t.id);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("renamed");
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
  });
});

describe("DELETE /api/todos/:id (AC3)", () => {
  it("removes the todo, recomputes progress and keeps the column contiguous", async () => {
    const plan = await makePlan();
    const mk = async (title: string, status = "todo") =>
      (await call(todos.POST, "POST", { title, status, date: "2026-10-06", weeklyPlanId: plan })).body;
    const a = await mk("a");
    const b = await mk("b");
    await mk("c", "done");
    const progress = async () => (await call(((await import("@/app/api/weekly-plans/[id]/route")).GET), "GET", undefined, plan)).body.progress;
    expect((await progress()).percent).toBe(33);

    expect((await call(todoById.DELETE, "DELETE", undefined, a.id)).status).toBe(200);
    expect((await progress()).percent).toBe(50);
    const list = (await call(todos.GET, "GET", undefined, undefined, "?date=2026-10-06&status=todo")).body;
    expect(list.map((t: any) => [t.title, t.position])).toEqual([["b", 0]]);
    expect(list[0].id).toBe(b.id);
    expect((await call(todoById.GET, "GET", undefined, a.id)).status).toBe(404);
  });
});

describe("GET /api/todos filters", () => {
  it("filters by date, status, weeklyPlanId, yearGoalId and unlinked", async () => {
    const goal = (await call((await import("@/app/api/year-goals/route")).POST, "POST", { title: "g", year: 2026 })).body.id;
    const plan = await makePlan({ yearGoalId: goal });
    await call(todos.POST, "POST", { title: "linked", date: "2026-10-06", weeklyPlanId: plan, status: "doing" });
    await call(todos.POST, "POST", { title: "free", date: "2026-10-07" });
    const q = async (s: string) => (await call(todos.GET, "GET", undefined, undefined, s)).body.map((t: any) => t.title);
    expect(await q("?date=2026-10-06")).toEqual(["linked"]);
    expect(await q("?status=doing")).toEqual(["linked"]);
    expect(await q(`?weeklyPlanId=${plan}`)).toEqual(["linked"]);
    expect(await q(`?yearGoalId=${goal}`)).toEqual(["linked"]);
    expect(await q("?unlinked=true")).toEqual(["free"]);
    expect(await q("?from=2026-10-07&to=2026-10-31")).toEqual(["free"]);
    expect((await call(todos.GET, "GET", undefined, undefined, "?status=bogus")).status).toBe(400);
  });
});
