import mongoose from "mongoose";

interface Cache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalCache = globalThis as typeof globalThis & { __mongooseCache?: Cache };
const cache: Cache = (globalCache.__mongooseCache ??= { conn: null, promise: null });

/** Resets the cached connection (used by tests and after failed connects). */
export function resetDbCache() {
  cache.conn = null;
  cache.promise = null;
}

/**
 * Connects once per server instance. The cache lives on `globalThis` so dev
 * hot reloads and warm serverless invocations reuse the same connection.
 */
export async function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  }
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  cache.promise ??= mongoose
    .connect(uri, {
      // Serverless: every instance opens its own pool, so keep it small.
      maxPoolSize: 5,
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 5000),
    })
    .catch((error) => {
      cache.promise = null;
      throw error;
    });

  cache.conn = await cache.promise;
  return cache.conn;
}
