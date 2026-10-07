import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { setupTestDb } from "../helpers/db";
import { Todo, WeeklyPlan, YearGoal } from "@/lib/models";
import { GET as health } from "@/app/api/health/route";
import { connectDb, resetDbCache } from "@/lib/db";
import { DEV_USER_ID } from "@/lib/auth";

describe("db layer (in-memory replica set)", () => {
  setupTestDb();

  it("registers the models and their indexes", async () => {
    const todoIdx = (await Todo.collection.indexes()).map((i) => Object.keys(i.key).join(","));
    expect(todoIdx).toContain("userId,date,status,position");
    expect(todoIdx).toContain("userId,weeklyPlanId");
    const planIdx = (await WeeklyPlan.collection.indexes()).map((i) => Object.keys(i.key).join(","));
    expect(planIdx).toContain("userId,yearGoalId");
    expect(await YearGoal.countDocuments()).toBe(0);
  });

  it("applies defaults: status todo, nullable links", async () => {
    const todo = await Todo.create({ title: "a", userId: DEV_USER_ID });
    expect(todo.status).toBe("todo");
    expect(todo.weeklyPlanId).toBeNull();
    expect(todo.date).toBeNull();
  });

  it("serializes ids as strings and never exposes userId", async () => {
    const goal = await YearGoal.create({ title: "g", year: 2026, userId: DEV_USER_ID });
    const plan = await WeeklyPlan.create({
      title: "w", startDate: "2026-10-05", endDate: "2026-10-11", yearGoalId: goal._id, userId: DEV_USER_ID,
    });
    const json = plan.toJSON() as unknown as Record<string, unknown>;
    expect(typeof json.id).toBe("string");
    expect(json._id).toBeUndefined();
    expect(json.userId).toBeUndefined();
    expect(json.yearGoalId).toBe(String(goal._id));
  });

  it("supports transactions", async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await Todo.create([{ title: "in tx", userId: DEV_USER_ID }], { session });
    });
    await session.endSession();
    expect(await Todo.countDocuments({ title: "in tx" })).toBe(1);

    const s2 = await mongoose.startSession();
    await expect(
      s2.withTransaction(async () => {
        await Todo.create([{ title: "rolled back", userId: DEV_USER_ID }], { session: s2 });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    await s2.endSession();
    expect(await Todo.countDocuments({ title: "rolled back" })).toBe(0);
  });

  it("GET /api/health returns 200 when connected", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("reuses the cached connection", async () => {
    const a = await connectDb();
    const b = await connectDb();
    expect(a).toBe(b);
  });
});

describe("db failure modes", () => {
  it("connectDb throws a clear error when MONGODB_URI is missing", async () => {
    const saved = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    resetDbCache();
    await expect(connectDb()).rejects.toThrow(/MONGODB_URI/);
    if (saved) process.env.MONGODB_URI = saved;
  });

  it("GET /api/health returns 503 when the database is unreachable", async () => {
    await mongoose.disconnect();
    resetDbCache();
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1/todo_test";
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = "300";
    const res = await health();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("DB_UNAVAILABLE");
    delete process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS;
    resetDbCache();
  });
});
