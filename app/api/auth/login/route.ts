import { NextResponse } from "next/server";
import { User } from "@/lib/models";
import { connectDb } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, authConfigured, createSessionToken, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(req: Request) {
  if (!authConfigured()) return fail(503, "AUTH_NOT_CONFIGURED", "SESSION_SECRET is not configured");

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "이메일과 비밀번호를 입력하세요.");

  try {
    await connectDb();
  } catch {
    return fail(503, "DB_UNAVAILABLE", "Database connection failed");
  }

  const user = await User.findOne({ email: parsed.data.email });
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return fail(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  const res = NextResponse.json({ ok: true, email: user.email });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(String(user._id)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
