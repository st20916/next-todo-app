import { Todo, WeeklyPlan } from "@/lib/models";
import { json, parseBody, route } from "@/lib/api";
import { addDays, isWithinPeriod } from "@/lib/period";
import { carryOverSchema, TODO_STATUSES } from "@/lib/validation/schemas";
import { bottomPosition, renumberColumn } from "@/lib/services/todos";
import { withTx } from "@/lib/services/tx";

export const dynamic = "force-dynamic";

/** Moves every unfinished todo of `date` to the next day, keeping its status. */
export const POST = route(async (req, _ctx, userId) => {
  const { date } = await parseBody(req, carryOverSchema);
  const nextDate = addDays(date, 1);

  const result = await withTx(async (session) => {
    const pending = await Todo.find({ userId, date, status: { $ne: "done" } })
      .sort({ position: 1, createdAt: 1, _id: 1 })
      .session(session);

    const planIds = [...new Set(pending.map((t) => String(t.weeklyPlanId)).filter((id) => id !== "null"))];
    const plans = await WeeklyPlan.find({ userId, _id: { $in: planIds } }).session(session);
    const planById = new Map(plans.map((p) => [String(p._id), p]));

    let unlinked = 0;
    const nextPos = new Map<string, number>();
    for (const status of TODO_STATUSES) nextPos.set(status, await bottomPosition(userId, nextDate, status, session));

    for (const todo of pending) {
      const plan = todo.weeklyPlanId ? planById.get(String(todo.weeklyPlanId)) : undefined;
      if (plan && !isWithinPeriod(nextDate, plan.startDate, plan.endDate)) {
        todo.weeklyPlanId = null;
        unlinked++;
      }
      todo.date = nextDate;
      todo.position = nextPos.get(todo.status)!;
      nextPos.set(todo.status, todo.position + 1);
      await todo.save({ session });
    }

    for (const status of TODO_STATUSES) await renumberColumn(userId, date, status, session);
    return { moved: pending.length, unlinked };
  });

  return json({ ...result, date, nextDate });
});
