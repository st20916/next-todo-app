import mongoose, { type ClientSession } from "mongoose";

/** Runs `fn` in a transaction (Atlas and the test replica set both support it). */
export async function withTx<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
