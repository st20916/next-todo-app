import { assertId, json, parseBody, route } from "@/lib/api";
import { todoMoveSchema } from "@/lib/validation/schemas";
import { moveTodo } from "@/lib/services/todos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx, userId) => {
  const id = assertId((await ctx.params).id);
  const { status, position } = await parseBody(req, todoMoveSchema);
  const todo = await moveTodo(userId, id, status, position);
  return json(todo!.toJSON());
});
