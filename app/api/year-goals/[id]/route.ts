import { WeeklyPlan, YearGoal } from "@/lib/models";
import { assertId, json, notFound, parseBody, route } from "@/lib/api";
import { aggregateProgress } from "@/lib/progress";
import { yearGoalUpdateSchema } from "@/lib/validation/schemas";
import { weeklyCounts, weeklyProgressFor } from "@/lib/services/progress";
import { withTx } from "@/lib/services/tx";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function detail(userId: string, id: string) {
  const goal = await YearGoal.findOne({ _id: id, userId });
  if (!goal) throw notFound("Year goal");
  const [plans, counts] = await Promise.all([
    WeeklyPlan.find({ yearGoalId: id, userId }).sort({ startDate: 1 }),
    weeklyCounts(userId),
  ]);
  const weeklyPlans = plans.map((p) => ({ ...p.toJSON(), progress: weeklyProgressFor(counts, String(p._id)) }));
  const progress = aggregateProgress(weeklyPlans.map((p) => p.progress));
  return { ...goal.toJSON(), weeklyPlanCount: weeklyPlans.length, progress, weeklyPlans };
}

export const GET = route<Ctx>(async (_req, ctx, userId) => json(await detail(userId, assertId((await ctx.params).id))));

export const PATCH = route<Ctx>(async (req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const input = await parseBody(req, yearGoalUpdateSchema);
  const goal = await YearGoal.findOne({ _id: id, userId });
  if (!goal) throw notFound("Year goal");
  Object.assign(goal, input);
  await goal.save();
  return json(await detail(userId, id));
});

export const DELETE = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const unlinked = await withTx(async (session) => {
    const goal = await YearGoal.findOne({ _id: id, userId }).session(session);
    if (!goal) throw notFound("Year goal");
    const res = await WeeklyPlan.updateMany({ yearGoalId: goal._id, userId }, { $set: { yearGoalId: null } }, { session });
    await goal.deleteOne({ session });
    return res.modifiedCount;
  });
  return json({ ok: true, unlinkedWeeklyPlans: unlinked });
});
