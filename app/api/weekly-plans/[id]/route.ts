import { Todo, WeeklyPlan, YearGoal } from "@/lib/models";
import { ApiError, assertId, json, notFound, parseBody, route } from "@/lib/api";
import { weeklyPlanUpdateSchema } from "@/lib/validation/schemas";
import { weeklyCounts, weeklyProgressFor } from "@/lib/services/progress";
import { withTx } from "@/lib/services/tx";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const plan = await WeeklyPlan.findOne({ _id: id, userId });
  if (!plan) throw notFound("Weekly plan");
  const counts = await weeklyCounts(userId);
  return json({ ...plan.toJSON(), progress: weeklyProgressFor(counts, id) });
});

export const PATCH = route<Ctx>(async (req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const input = await parseBody(req, weeklyPlanUpdateSchema);
  const plan = await WeeklyPlan.findOne({ _id: id, userId });
  if (!plan) throw notFound("Weekly plan");

  const startDate = input.startDate ?? plan.startDate;
  const endDate = input.endDate ?? plan.endDate;
  if (startDate > endDate) throw new ApiError(400, "VALIDATION_ERROR", "startDate must be on or before endDate");

  if (input.yearGoalId) {
    assertId(input.yearGoalId);
    if (!(await YearGoal.exists({ _id: input.yearGoalId, userId }))) throw notFound("Year goal");
  }

  if (startDate !== plan.startDate || endDate !== plan.endDate) {
    const outside = await Todo.countDocuments({
      userId,
      weeklyPlanId: plan._id,
      date: { $ne: null },
      $or: [{ date: { $lt: startDate } }, { date: { $gt: endDate } }],
    });
    if (outside > 0) {
      throw new ApiError(409, "PERIOD_CONFLICT", `${outside} linked todo(s) would fall outside the new period`, {
        count: outside,
      });
    }
  }

  if (input.title !== undefined) plan.title = input.title;
  plan.startDate = startDate;
  plan.endDate = endDate;
  if (input.yearGoalId !== undefined) plan.yearGoalId = input.yearGoalId as never;
  await plan.save();

  const counts = await weeklyCounts(userId);
  return json({ ...plan.toJSON(), progress: weeklyProgressFor(counts, id) });
});

export const DELETE = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const unlinked = await withTx(async (session) => {
    const plan = await WeeklyPlan.findOne({ _id: id, userId }).session(session);
    if (!plan) throw notFound("Weekly plan");
    const res = await Todo.updateMany({ weeklyPlanId: plan._id, userId }, { $set: { weeklyPlanId: null } }, { session });
    await plan.deleteOne({ session });
    return res.modifiedCount;
  });
  return json({ ok: true, unlinkedTodos: unlinked });
});
