import { NextResponse } from "next/server";
import { User } from "@/lib/models";
import { connectDb } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, authConfigured, createSessionToken, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(req: Request) {
  if (!authConfigured()) return fail(503, "AUTH_NOT_CONFIGURED", "SESSION_SECRET is not configured");

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "이메일과 8자 이상의 비밀번호를 입력하세요.");

  try {
    await connectDb();
  } catch {
    return fail(503, "DB_UNAVAILABLE", "Database connection failed");
  }

  const { email, password } = parsed.data;
  let user;
  try {
    user = await User.create({ email, passwordHash: await hashPassword(password) });
  } catch (err) {
    // Unique index on email: let the DB settle the race on concurrent signups.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return fail(409, "EMAIL_TAKEN", "이미 가입된 이메일입니다.");
    }
    throw err;
  }

  const res = NextResponse.json({ ok: true, email: user.email }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(String(user._id)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
