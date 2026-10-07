import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const m = await connectDb();
    await m.connection.db!.admin().ping();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: { code: "DB_UNAVAILABLE", message: "Database connection failed" } },
      { status: 503 },
    );
  }
}
