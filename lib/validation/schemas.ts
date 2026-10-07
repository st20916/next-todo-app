import { z } from "zod";

export const TODO_STATUSES = ["todo", "doing", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "invalid calendar date");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "invalid id");
const title = z.string().trim().min(1, "title is required").max(200);
const description = z.string().max(5000);

const email = z.string().trim().toLowerCase().min(3, "email is required").max(200).email("invalid email");

export const registerSchema = z.object({
  email,
  password: z.string().min(8, "password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "password is required").max(200),
});

export const todoCreateSchema = z.object({
  title,
  description: description.optional(),
  date: dateString.nullable().optional(),
  weeklyPlanId: objectId.nullable().optional(),
  status: z.enum(TODO_STATUSES).default("todo"),
});

export const todoUpdateSchema = z
  .object({
    title,
    description,
    date: dateString.nullable(),
    weeklyPlanId: objectId.nullable(),
    status: z.enum(TODO_STATUSES),
  })
  .partial();

export const todoMoveSchema = z.object({
  status: z.enum(TODO_STATUSES),
  position: z.number().int().min(0),
});

export const carryOverSchema = z.object({ date: dateString });

export const weeklyPlanCreateSchema = z
  .object({
    title,
    startDate: dateString,
    endDate: dateString,
    yearGoalId: objectId.nullable().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export const weeklyPlanUpdateSchema = z
  .object({
    title,
    startDate: dateString,
    endDate: dateString,
    yearGoalId: objectId.nullable(),
  })
  .partial();

export const yearGoalCreateSchema = z.object({
  title,
  description: description.optional(),
  year: z.number().int().min(1970).max(2200),
});

export const yearGoalUpdateSchema = yearGoalCreateSchema.partial();

export const todoQuerySchema = z.object({
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  status: z.enum(TODO_STATUSES).optional(),
  weeklyPlanId: objectId.optional(),
  yearGoalId: objectId.optional(),
  unlinked: z.enum(["true", "false"]).optional(),
});
