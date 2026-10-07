import { WeeklyPlan, YearGoal } from "@/lib/models";
import { json, parseBody, route } from "@/lib/api";
import { aggregateProgress } from "@/lib/progress";
import { yearGoalCreateSchema } from "@/lib/validation/schemas";
import { weeklyCounts } from "@/lib/services/progress";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, _ctx, userId) => {
  const [goals, plans, counts] = await Promise.all([
    YearGoal.find({ userId }).sort({ year: -1, createdAt: 1 }),
    WeeklyPlan.find({ userId, yearGoalId: { $ne: null } }).select("_id yearGoalId"),
    weeklyCounts(userId),
  ]);
  return json(
    goals.map((g) => {
      const mine = plans.filter((p) => String(p.yearGoalId) === String(g._id));
      const progress = aggregateProgress(mine.map((p) => counts.get(String(p._id)) ?? { done: 0, total: 0 }));
      return { ...g.toJSON(), weeklyPlanCount: mine.length, progress };
    }),
  );
});

export const POST = route(async (req, _ctx, userId) => {
  const input = await parseBody(req, yearGoalCreateSchema);
  const goal = await YearGoal.create({ ...input, userId });
  return json({ ...goal.toJSON(), weeklyPlanCount: 0, progress: { done: 0, total: 0, percent: 0 } }, 201);
});
