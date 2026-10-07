import mongoose from "mongoose";
import { Todo } from "@/lib/models";
import { calcProgress, type Progress } from "@/lib/progress";

/** done/total per weekly plan id, computed from todos at read time (scoped to one member). */
export async function weeklyCounts(userId: string): Promise<Map<string, { done: number; total: number }>> {
  const rows = await Todo.aggregate<{ _id: unknown; total: number; done: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId), weeklyPlanId: { $ne: null } } },
    {
      $group: {
        _id: "$weeklyPlanId",
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { done: r.done, total: r.total }]));
}

export function weeklyProgressFor(counts: Map<string, { done: number; total: number }>, planId: string): Progress {
  const c = counts.get(planId);
  return calcProgress(c?.done ?? 0, c?.total ?? 0);
}
