import type { ClientSession } from "mongoose";
import { Todo, WeeklyPlan } from "@/lib/models";
import { ApiError, notFound } from "@/lib/api";
import { isWithinPeriod } from "@/lib/period";
import type { TodoStatus } from "@/lib/validation/schemas";
import { withTx } from "@/lib/services/tx";

/** Rewrites positions of one (date,status) column to 0..n-1, keeping relative order. */
export async function renumberColumn(
  userId: string,
  date: string | null,
  status: TodoStatus,
  session?: ClientSession,
) {
  const items = await Todo.find({ userId, date, status })
    .sort({ position: 1, createdAt: 1, _id: 1 })
    .select("_id position")
    .session(session ?? null);
  const ops = items.flatMap((t, i) =>
    t.position === i ? [] : [{ updateOne: { filter: { _id: t._id }, update: { $set: { position: i } } } }],
  );
  if (ops.length) await Todo.bulkWrite(ops, { session });
}

export async function bottomPosition(
  userId: string,
  date: string | null,
  status: TodoStatus,
  session?: ClientSession,
): Promise<number> {
  const last = await Todo.findOne({ userId, date, status }).sort({ position: -1 }).select("position").session(session ?? null);
  return last ? last.position + 1 : 0;
}

/** Throws 400 PERIOD_MISMATCH / 404 when a todo's date does not fit its weekly plan. */
export async function assertTodoFitsPlan(userId: string, planId: string | null | undefined, date: string | null | undefined) {
  if (!planId) return;
  const plan = await WeeklyPlan.findOne({ _id: planId, userId });
  if (!plan) throw notFound("Weekly plan");
  if (!isWithinPeriod(date, plan.startDate, plan.endDate)) {
    throw new ApiError(
      400,
      "PERIOD_MISMATCH",
      `Todo date ${date} is outside the weekly plan period ${plan.startDate} ~ ${plan.endDate}`,
    );
  }
}

/** Moves a todo to `status` at `position`, keeping both columns contiguous. */
export async function moveTodo(userId: string, id: string, status: TodoStatus, position: number) {
  return withTx(async (session) => {
    const todo = await Todo.findOne({ _id: id, userId }).session(session);
    if (!todo) throw notFound("Todo");

    const source = await Todo.find({ userId, date: todo.date, status: todo.status, _id: { $ne: todo._id } })
      .sort({ position: 1, createdAt: 1, _id: 1 })
      .select("_id")
      .session(session);
    const sameColumn = todo.status === status;
    const target = sameColumn
      ? source
      : await Todo.find({ userId, date: todo.date, status })
          .sort({ position: 1, createdAt: 1, _id: 1 })
          .select("_id")
          .session(session);

    const ids = target.map((t) => String(t._id));
    ids.splice(Math.min(position, ids.length), 0, String(todo._id));

    const ops = ids.map((tid, i) => ({
      updateOne: {
        filter: { _id: tid },
        update: { $set: tid === String(todo._id) ? { position: i, status } : { position: i } },
      },
    }));
    if (!sameColumn) {
      source.forEach((t, i) => ops.push({ updateOne: { filter: { _id: String(t._id)}, update: { $set: { position: i } } } }));
    }
    await Todo.bulkWrite(ops, { session });
    return Todo.findOne({ _id: id, userId }).session(session);
  });
}
