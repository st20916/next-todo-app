/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { setupTestDb } from "../helpers/db";
import { call } from "../helpers/http";
import * as todos from "@/app/api/todos/route";
import * as todoById from "@/app/api/todos/[id]/route";
import * as plans from "@/app/api/weekly-plans/route";
import * as planById from "@/app/api/weekly-plans/[id]/route";
import * as planImpact from "@/app/api/weekly-plans/[id]/impact/route";
import * as goals from "@/app/api/year-goals/route";
import * as goalById from "@/app/api/year-goals/[id]/route";
import * as goalImpact from "@/app/api/year-goals/[id]/impact/route";

setupTestDb();

const goal = async () => (await call(goals.POST, "POST", { title: "G", year: 2026 })).body.id as string;
const plan = async (yearGoalId: string | null = null, startDate = "2026-10-05", endDate = "2026-10-11") =>
  (await call(plans.POST, "POST", { title: `P${startDate}`, startDate, endDate, yearGoalId })).body.id as string;
const todo = async (weeklyPlanId: string | null, status = "todo", date = "2026-10-06") =>
  (await call(todos.POST, "POST", { title: "t", status, date, weeklyPlanId })).body.id as string;
const planProgress = async (id: string) => (await call(planById.GET, "GET", undefined, id)).body.progress;
const goalProgress = async (id: string) => (await call(goalById.GET, "GET", undefined, id)).body.progress;

describe("weekly progress (AC6, AC7)", () => {
  it("is 0% with no todos", async () => {
    expect(await planProgress(await plan())).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("1 of 3 done is 33%", async () => {
    const p = await plan();
    await todo(p, "done");
    await todo(p);
    await todo(p, "doing");
    expect((await planProgress(p)).percent).toBe(33);
  });

  it("reflects create, status change, relink and delete immediately", async () => {
    const p = await plan();
    const q = await plan(null, "2026-10-12", "2026-10-18");
    const a = await todo(p);
    expect((await planProgress(p)).percent).toBe(0);
    await call(todoById.PATCH, "PATCH", { status: "done" }, a);
    expect((await planProgress(p)).percent).toBe(100);
    await call(todoById.PATCH, "PATCH", { weeklyPlanId: null }, a);
    expect(await planProgress(p)).toEqual({ done: 0, total: 0, percent: 0 });
    await call(todoById.PATCH, "PATCH", { weeklyPlanId: q, date: "2026-10-13" }, a);
    expect((await planProgress(q)).percent).toBe(100);
    await call(todoById.DELETE, "DELETE", undefined, a);
    expect((await planProgress(q)).percent).toBe(0);
  });

  it("list endpoint includes progress", async () => {
    const p = await plan();
    await todo(p, "done");
    const list = (await call(plans.GET, "GET")).body;
    expect(list.find((x: any) => x.id === p).progress.percent).toBe(100);
  });
});

describe("year goal progress is weighted (AC11)", () => {
  it("A 1/1 done + B 0/3 -> 25%, not 50%", async () => {
    const g = await goal();
    const a = await plan(g);
    const b = await plan(g, "2026-10-12", "2026-10-18");
    await todo(a, "done");
    for (let i = 0; i < 3; i++) await todo(b, "todo", "2026-10-13");
    expect(await goalProgress(g)).toEqual({ done: 1, total: 4, percent: 25 });
    const list = (await call(goals.GET, "GET")).body;
    expect(list[0].progress.percent).toBe(25);
    expect(list[0].weeklyPlanCount).toBe(2);
  });

  it("is 0% with no plans and updates when a todo is completed", async () => {
    const g = await goal();
    expect((await goalProgress(g)).percent).toBe(0);
    const p = await plan(g);
    const t = await todo(p);
    await call(todoById.PATCH, "PATCH", { status: "done" }, t);
    expect((await goalProgress(g)).percent).toBe(100);
  });

  it("unlinked plans and todos count toward no goal (AC8)", async () => {
    const g = await goal();
    const p = await plan(g);
    await todo(p, "done");
    await call(planById.PATCH, "PATCH", { yearGoalId: null }, p);
    expect((await goalProgress(g)).percent).toBe(0);
    await call(planById.PATCH, "PATCH", { yearGoalId: g }, p);
    expect((await goalProgress(g)).percent).toBe(100);
  });
});

describe("delete = SetNull with impact counts (AC12)", () => {
  it("weekly plan: impact lists todos, delete keeps them unlinked", async () => {
    const p = await plan();
    const t1 = await todo(p);
    await todo(p, "done");
    expect((await call(planImpact.GET, "GET", undefined, p)).body).toEqual({ todos: 2 });
    const del = await call(planById.DELETE, "DELETE", undefined, p);
    expect(del.body).toMatchObject({ ok: true, unlinkedTodos: 2 });
    const kept = (await call(todoById.GET, "GET", undefined, t1)).body;
    expect(kept.weeklyPlanId).toBeNull();
    expect((await call(todos.GET, "GET", undefined, undefined, "?unlinked=true")).body).toHaveLength(2);
    expect((await call(planById.GET, "GET", undefined, p)).status).toBe(404);
  });

  it("year goal: impact lists plans+todos, delete keeps plans unlinked", async () => {
    const g = await goal();
    const p1 = await plan(g);
    await plan(g, "2026-10-12", "2026-10-18");
    await todo(p1);
    expect((await call(goalImpact.GET, "GET", undefined, g)).body).toEqual({ weeklyPlans: 2, todos: 1 });
    expect((await call(goalById.DELETE, "DELETE", undefined, g)).body).toMatchObject({ unlinkedWeeklyPlans: 2 });
    expect((await call(planById.GET, "GET", undefined, p1)).body.yearGoalId).toBeNull();
    expect((await call(plans.GET, "GET", undefined, undefined, "?unlinked=true")).body).toHaveLength(2);
    expect((await call(todos.GET, "GET")).body).toHaveLength(1);
  });

  it("impact of an unknown id is 404", async () => {
    expect((await call(planImpact.GET, "GET", undefined, "64b64b64b64b64b64b64b64b")).status).toBe(404);
    expect((await call(goalImpact.GET, "GET", undefined, "64b64b64b64b64b64b64b64b")).status).toBe(404);
  });
});

describe("period change conflict (AC13)", () => {
  it("returns 409 with the count and leaves the plan unchanged", async () => {
    const p = await plan();
    await todo(p, "todo", "2026-10-05");
    await todo(p, "todo", "2026-10-11");
    const res = await call(planById.PATCH, "PATCH", { startDate: "2026-10-07" }, p);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "PERIOD_CONFLICT", count: 1 });
    expect((await call(planById.GET, "GET", undefined, p)).body.startDate).toBe("2026-10-05");
  });

  it("allows widening the period and ignores undated todos", async () => {
    const p = await plan();
    await call(todos.POST, "POST", { title: "backlog", weeklyPlanId: p });
    expect((await call(planById.PATCH, "PATCH", { startDate: "2026-10-12", endDate: "2026-10-18" }, p)).status).toBe(200);
  });

  it("rejects startDate after endDate", async () => {
    const p = await plan();
    expect((await call(planById.PATCH, "PATCH", { startDate: "2026-10-20" }, p)).status).toBe(400);
  });
});

describe("validation and CRUD basics", () => {
  it("rejects a plan with an unknown year goal and bad dates", async () => {
    expect((await call(plans.POST, "POST", { ...{ title: "x", startDate: "2026-10-05", endDate: "2026-10-11" }, yearGoalId: "64b64b64b64b64b64b64b64b" })).status).toBe(404);
    expect((await call(plans.POST, "POST", { title: "x", startDate: "2026-10-11", endDate: "2026-10-05" })).status).toBe(400);
  });

  it("updates a goal and a plan title", async () => {
    const g = await goal();
    const p = await plan();
    expect((await call(goalById.PATCH, "PATCH", { title: "renamed", year: 2027 }, g)).body).toMatchObject({ title: "renamed", year: 2027 });
    expect((await call(planById.PATCH, "PATCH", { title: "renamed" }, p)).body.title).toBe("renamed");
    expect((await call(goals.POST, "POST", { year: 2026 })).status).toBe(400);
  });
});
