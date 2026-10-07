import { describe, expect, it } from "vitest";
import {
  carryOverSchema,
  loginSchema,
  registerSchema,
  todoCreateSchema,
  todoMoveSchema,
  todoUpdateSchema,
  weeklyPlanCreateSchema,
} from "@/lib/validation/schemas";

describe("todoCreateSchema (AC1)", () => {
  it("rejects a missing title", () => {
    expect(todoCreateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a blank title", () => {
    expect(todoCreateSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("defaults status to todo", () => {
    const parsed = todoCreateSchema.parse({ title: "write plan" });
    expect(parsed.status).toBe("todo");
  });

  it("rejects an invalid calendar date", () => {
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026-02-30" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "x", date: "2026/02/10" }).success).toBe(false);
  });

  it("accepts null date and null weeklyPlanId", () => {
    expect(todoCreateSchema.safeParse({ title: "x", date: null, weeklyPlanId: null }).success).toBe(true);
  });
});

describe("todoUpdateSchema", () => {
  it("allows partial updates without applying the create default", () => {
    expect(todoUpdateSchema.parse({ title: "new" })).toEqual({ title: "new" });
  });
  it("still rejects an empty title", () => {
    expect(todoUpdateSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("todoMoveSchema / carryOverSchema", () => {
  it("rejects negative or fractional positions and unknown status", () => {
    expect(todoMoveSchema.safeParse({ status: "doing", position: -1 }).success).toBe(false);
    expect(todoMoveSchema.safeParse({ status: "doing", position: 1.5 }).success).toBe(false);
    expect(todoMoveSchema.safeParse({ status: "blocked", position: 0 }).success).toBe(false);
    expect(todoMoveSchema.safeParse({ status: "doing", position: 0 }).success).toBe(true);
  });
  it("requires a valid date for carry-over", () => {
    expect(carryOverSchema.safeParse({ date: "2026-10-06" }).success).toBe(true);
    expect(carryOverSchema.safeParse({}).success).toBe(false);
  });
});

describe("registerSchema / loginSchema", () => {
  it("rejects a password shorter than 8 characters on register", () => {
    expect(registerSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });
  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ email: "not-an-email", password: "pass1234" }).success).toBe(false);
  });
  it("lowercases and trims the email", () => {
    expect(registerSchema.parse({ email: " A@B.com ", password: "pass1234" }).email).toBe("a@b.com");
  });
  it("login only requires a non-empty password (length is checked against the hash)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("weeklyPlanCreateSchema", () => {
  it("requires startDate <= endDate", () => {
    const base = { title: "w41", yearGoalId: null };
    expect(weeklyPlanCreateSchema.safeParse({ ...base, startDate: "2026-10-05", endDate: "2026-10-11" }).success).toBe(true);
    expect(weeklyPlanCreateSchema.safeParse({ ...base, startDate: "2026-10-11", endDate: "2026-10-05" }).success).toBe(false);
  });
});
