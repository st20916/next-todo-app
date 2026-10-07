import { Todo, WeeklyPlan } from "@/lib/models";
import { assertId, json, notFound, route } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** What deleting this weekly plan would detach (todos are kept, only unlinked). */
export const GET = route<Ctx>(async (_req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  if (!(await WeeklyPlan.exists({ _id: id, userId }))) throw notFound("Weekly plan");
  return json({ todos: await Todo.countDocuments({ weeklyPlanId: id, userId }) });
});
