import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectDb, resetDbCache } from "@/lib/db";

/** Starts an in-memory replica set (transactions need one) for a test file. */
export function setupTestDb() {
  let replSet: MongoMemoryReplSet | undefined;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replSet.getUri("todo_test");
    resetDbCache();
    await connectDb();
    // Make sure collections and indexes exist before transactional tests.
    await Promise.all(Object.values(mongoose.models).map((m) => m.createCollection().catch(() => undefined)));
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    resetDbCache();
    await replSet?.stop();
  });
}
