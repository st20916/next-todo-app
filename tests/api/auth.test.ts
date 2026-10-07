import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as listTodos, POST as createTodo } from "@/app/api/todos/route";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "@/lib/auth";
import { setupTestDb } from "../helpers/db";

setupTestDb();

beforeEach(() => {
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
});
afterEach(() => vi.unstubAllEnvs());

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : undefined });
const cookieOf = (res: Response) => res.headers.get("set-cookie") ?? "";
const jsonReq = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const withCookie = (path: string, method: string, cookie: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function registerUser(email: string, password = "pass1234") {
  const res = await register(jsonReq("/api/auth/register", { email, password }));
  const token = cookieOf(res).split(";")[0].split("=")[1];
  return { res, cookie: `${SESSION_COOKIE}=${token}` };
}

describe("proxy blocks unauthenticated access", () => {
  it("returns 401 JSON for API paths", async () => {
    const res = await proxy(req("/api/todos"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("redirects pages to /login", async () => {
    const res = await proxy(req("/board"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("rejects a forged or expired cookie", async () => {
    expect((await proxy(req("/api/todos", `${SESSION_COOKIE}=9999999999.000000000000000000000001.deadbeef`))).status).toBe(401);
    const expired = await createSessionToken("000000000000000000000001", Date.now() - 8 * 24 * 3600 * 1000);
    expect((await proxy(req("/api/todos", `${SESSION_COOKIE}=${expired}`))).status).toBe(401);
  });

  it("lets /login, /register, /api/auth/login, /api/auth/register and /api/health through", async () => {
    for (const p of ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/health"]) {
      expect((await proxy(req(p))).headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("lets a valid session through", async () => {
    const { cookie } = await registerUser("proxy@test.com");
    expect((await proxy(req("/api/todos", cookie))).headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed with 503 when SESSION_SECRET is not configured", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await proxy(req("/api/todos"))).status).toBe(503);
    expect((await proxy(req("/board"))).status).toBe(503);
  });

  it("ignores AUTH_DISABLED in production", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect((await proxy(req("/api/todos"))).status).toBe(401);
  });

  it("requires SESSION_SECRET in production (503 without it)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect((await proxy(req("/api/todos"))).status).toBe(503);
  });

  it("treats a malformed cookie as unauthenticated (401, not 500)", async () => {
    expect((await proxy(req("/api/todos", `${SESSION_COOKIE}=%E0`))).status).toBe(401);
  });
});

describe("route handlers also enforce auth (defense in depth)", () => {
  it("401 without a session, 200 with one", async () => {
    const anon = await listTodos(new Request("http://localhost/api/todos"), undefined as never);
    expect(anon.status).toBe(401);
    const { cookie } = await registerUser("defense@test.com");
    const authed = await listTodos(new Request("http://localhost/api/todos", { headers: { cookie } }), undefined as never);
    expect(authed.status).toBe(200);
  });
});

describe("register", () => {
  it("rejects a short password and an invalid email with 400", async () => {
    expect((await register(jsonReq("/api/auth/register", { email: "a@b.com", password: "short" }))).status).toBe(400);
    expect((await register(jsonReq("/api/auth/register", { email: "not-an-email", password: "pass1234" }))).status).toBe(400);
  });

  it("creates the member and sets a session cookie", async () => {
    const res = await register(jsonReq("/api/auth/register", { email: "new@test.com", password: "pass1234" }));
    expect(res.status).toBe(201);
    const header = cookieOf(res);
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header.toLowerCase()).toContain("httponly");
    const token = header.split(";")[0].split("=")[1];
    expect(await verifySessionToken(token)).not.toBeNull();
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser("dupe@test.com");
    expect((await register(jsonReq("/api/auth/register", { email: "dupe@test.com", password: "pass1234" }))).status).toBe(409);
  });

  it("normalizes email case for the duplicate check", async () => {
    await registerUser("mixedcase@test.com");
    expect((await register(jsonReq("/api/auth/register", { email: "MixedCase@Test.com", password: "pass1234" }))).status).toBe(409);
  });

  it("returns 503 when SESSION_SECRET is not configured", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await register(jsonReq("/api/auth/register", { email: "x@y.com", password: "pass1234" }))).status).toBe(503);
  });
});

describe("login / logout", () => {
  it("rejects an unknown email and a wrong password with 401 and sets no cookie", async () => {
    const unknown = await login(jsonReq("/api/auth/login", { email: "nope@test.com", password: "whatever" }));
    expect(unknown.status).toBe(401);
    expect(cookieOf(unknown)).toBe("");

    await registerUser("wrongpw@test.com");
    const wrong = await login(jsonReq("/api/auth/login", { email: "wrongpw@test.com", password: "incorrect" }));
    expect(wrong.status).toBe(401);
  });

  it("rejects a missing email or password with 400", async () => {
    expect((await login(jsonReq("/api/auth/login", { password: "pass1234" }))).status).toBe(400);
    expect((await login(jsonReq("/api/auth/login", { email: "a@b.com" }))).status).toBe(400);
  });

  it("accepts the right credentials and sets an httpOnly session cookie that verifies", async () => {
    await registerUser("login@test.com");
    const res = await login(jsonReq("/api/auth/login", { email: "login@test.com", password: "pass1234" }));
    expect(res.status).toBe(200);
    const header = cookieOf(res);
    expect(header.toLowerCase()).toContain("httponly");
    expect(header.toLowerCase()).toContain("samesite=lax");
    const token = header.split(";")[0].split("=")[1];
    expect(await verifySessionToken(token)).not.toBeNull();
  });

  it("logout clears the cookie and redirects to /login", async () => {
    const res = await logout(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
    expect(cookieOf(res)).toMatch(/Max-Age=0/i);
  });
});

describe("GET /api/auth/me", () => {
  it("401 without a session, 200 with the member's email otherwise", async () => {
    const anon = await me(new Request("http://localhost/api/auth/me"), undefined as never);
    expect(anon.status).toBe(401);
    const { cookie } = await registerUser("me@test.com");
    const res = await me(new Request("http://localhost/api/auth/me", { headers: { cookie } }), undefined as never);
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe("me@test.com");
  });
});

describe("data is isolated per member", () => {
  it("member B never sees member A's todos", async () => {
    const a = await registerUser("a@isolation.com");
    const b = await registerUser("b@isolation.com");

    const created = await createTodo(withCookie("/api/todos", "POST", a.cookie, { title: "A's secret" }), undefined as never);
    expect(created.status).toBe(201);
    const todoId = (await created.json()).id as string;

    const asA = await listTodos(withCookie("/api/todos", "GET", a.cookie), undefined as never);
    expect(await asA.json()).toHaveLength(1);

    const asB = await listTodos(withCookie("/api/todos", "GET", b.cookie), undefined as never);
    expect(await asB.json()).toHaveLength(0);

    const { GET: getTodoById } = await import("@/app/api/todos/[id]/route");
    const res = await getTodoById(withCookie(`/api/todos/${todoId}`, "GET", b.cookie), { params: Promise.resolve({ id: todoId }) });
    expect(res.status).toBe(404);
  });
});
