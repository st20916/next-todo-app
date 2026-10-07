import { WeeklyPlan, YearGoal } from "@/lib/models";
import { assertId, json, notFound, parseBody, route } from "@/lib/api";
import { weeklyPlanCreateSchema } from "@/lib/validation/schemas";
import { weeklyCounts, weeklyProgressFor } from "@/lib/services/progress";

export const dynamic = "force-dynamic";

export const GET = route(async (req, _ctx, userId) => {
  const params = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = { userId };
  const goal = params.get("yearGoalId");
  if (params.get("unlinked") === "true") filter.yearGoalId = null;
  else if (goal) filter.yearGoalId = assertId(goal);

  const [plans, counts] = await Promise.all([WeeklyPlan.find(filter).sort({ startDate: 1 }), weeklyCounts(userId)]);
  return json(plans.map((p) => ({ ...p.toJSON(), progress: weeklyProgressFor(counts, String(p._id)) })));
});

export const POST = route(async (req, _ctx, userId) => {
  const input = await parseBody(req, weeklyPlanCreateSchema);
  if (input.yearGoalId) {
    assertId(input.yearGoalId);
    if (!(await YearGoal.exists({ _id: input.yearGoalId, userId }))) throw notFound("Year goal");
  }
  const plan = await WeeklyPlan.create({ ...input, yearGoalId: input.yearGoalId ?? null, userId });
  return json({ ...plan.toJSON(), progress: { done: 0, total: 0, percent: 0 } }, 201);
});
