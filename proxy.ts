import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, authDisabled, isAuthenticated } from "@/lib/auth";

const PUBLIC = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (authDisabled() || PUBLIC.includes(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  if (!authConfigured()) {
    // Fail closed: a deployment without SESSION_SECRET must never serve data.
    return isApi
      ? NextResponse.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "SESSION_SECRET is not configured" } }, { status: 503 })
      : new NextResponse("SESSION_SECRET is not configured", { status: 503 });
  }

  if (await isAuthenticated(request)) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
