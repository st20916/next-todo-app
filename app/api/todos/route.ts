import { Todo, WeeklyPlan } from "@/lib/models";
import { assertId, json, parseBody, parseQuery, route } from "@/lib/api";
import { todoCreateSchema, todoQuerySchema } from "@/lib/validation/schemas";
import { assertDateNotFuture, assertTodoFitsPlan, bottomPosition } from "@/lib/services/todos";

export const dynamic = "force-dynamic";

export const GET = route(async (req, _ctx, userId) => {
  const q = parseQuery(req, todoQuerySchema);
  const filter: Record<string, unknown> = { userId };

  if (q.date) filter.date = q.date;
  else if (q.from || q.to) {
    filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  }
  if (q.status) filter.status = q.status;

  if (q.unlinked === "true") filter.weeklyPlanId = null;
  else if (q.weeklyPlanId) filter.weeklyPlanId = q.weeklyPlanId;
  else if (q.yearGoalId) {
    const plans = await WeeklyPlan.find({ userId, yearGoalId: q.yearGoalId }).select("_id");
    filter.weeklyPlanId = { $in: plans.map((p) => p._id) };
  }

  const todos = await Todo.find(filter).sort({ date: 1, position: 1, createdAt: 1 });
  return json(todos.map((t) => t.toJSON()));
});

export const POST = route(async (req, _ctx, userId) => {
  const input = await parseBody(req, todoCreateSchema);
  if (input.weeklyPlanId) assertId(input.weeklyPlanId);
  assertDateNotFuture(input.date);
  await assertTodoFitsPlan(userId, input.weeklyPlanId, input.date);

  const date = input.date ?? null;
  const todo = await Todo.create({
    title: input.title,
    description: input.description ?? "",
    date,
    status: input.status,
    weeklyPlanId: input.weeklyPlanId ?? null,
    position: await bottomPosition(userId, date, input.status),
    userId,
  });
  return json(todo.toJSON(), 201);
});
