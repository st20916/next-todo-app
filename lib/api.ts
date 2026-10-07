import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ZodError, type ZodType } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { connectDb } from "@/lib/db";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

type Handler<C> = (req: Request, ctx: C, userId: string) => Promise<Response>;
type RouteFn<C> = (req: Request, ctx: C) => Promise<Response>;

/** Connects to the DB, resolves the member's userId and maps thrown errors to the `{error:{code,message}}` format. */
export function route<C = unknown>(fn: Handler<C>): RouteFn<C> {
  return async (req, ctx) => {
    try {
      // Defense in depth: the proxy already guards these paths.
      const userId = await getSessionUserId(req);
      if (!userId) throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      try {
        await connectDb();
      } catch {
        throw new ApiError(503, "DB_UNAVAILABLE", "Database connection failed");
      }
      return await fn(req, ctx, userId);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message, error.extra);
      if (error instanceof ZodError) {
        const message = error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
        return errorResponse(400, "VALIDATION_ERROR", message);
      }
      console.error(error);
      return errorResponse(500, "INTERNAL_ERROR", "Unexpected server error");
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

export function assertId(id: string): string {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "NOT_FOUND", "Resource not found");
  return id;
}

export const notFound = (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found`);
