import { User } from "@/lib/models";
import { json, notFound, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, _ctx, userId) => {
  const user = await User.findById(userId).select("email");
  if (!user) throw notFound("User");
  return json({ email: user.email });
});
