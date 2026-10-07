import { Todo, WeeklyPlan, YearGoal } from "@/lib/models";
import { assertId, json, notFound, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** What deleting this goal would detach (weekly plans and todos are kept). */
export const GET = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  if (!(await YearGoal.exists({ _id: id, userId }))) throw notFound("Year goal");
  const plans = await WeeklyPlan.find({ yearGoalId: id, userId }).select("_id");
  const todos = await Todo.countDocuments({ weeklyPlanId: { $in: plans.map((p) => p._id) }, userId });
  return json({ weeklyPlans: plans.length, todos });
});
