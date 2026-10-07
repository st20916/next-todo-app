import { Todo } from "@/lib/models";
import { assertId, json, notFound, parseBody, route } from "@/lib/api";
import { todoUpdateSchema } from "@/lib/validation/schemas";
import { assertTodoFitsPlan, bottomPosition, renumberColumn } from "@/lib/services/todos";
import { withTx } from "@/lib/services/tx";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, ctx, userId) => {
  const todo = await Todo.findOne({ _id: assertId((await ctx.params).id), userId });
  if (!todo) throw notFound("Todo");
  return json(todo.toJSON());
});

export const PATCH = route<Ctx>(async (req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const input = await parseBody(req, todoUpdateSchema);

  const updated = await withTx(async (session) => {
    const todo = await Todo.findOne({ _id: id, userId }).session(session);
    if (!todo) throw notFound("Todo");

    const nextDate = input.date !== undefined ? input.date : todo.date;
    const nextPlan = input.weeklyPlanId !== undefined ? input.weeklyPlanId : todo.weeklyPlanId ? String(todo.weeklyPlanId) : null;
    const nextStatus = input.status ?? todo.status;
    await assertTodoFitsPlan(userId, nextPlan, nextDate);

    const columnChanged = nextDate !== todo.date || nextStatus !== todo.status;
    const prev = { date: todo.date, status: todo.status };

    if (input.title !== undefined) todo.title = input.title;
    if (input.description !== undefined) todo.description = input.description;
    todo.date = nextDate;
    todo.status = nextStatus;
    todo.weeklyPlanId = nextPlan as never;
    if (columnChanged) todo.position = await bottomPosition(userId, nextDate, nextStatus, session);
    await todo.save({ session });

    if (columnChanged) await renumberColumn(userId, prev.date, prev.status, session);
    return todo;
  });
  return json(updated.toJSON());
});

export const DELETE = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  await withTx(async (session) => {
    const todo = await Todo.findOneAndDelete({ _id: id, userId }, { session });
    if (!todo) throw notFound("Todo");
    await renumberColumn(userId, todo.date, todo.status, session);
  });
  return json({ ok: true });
});
