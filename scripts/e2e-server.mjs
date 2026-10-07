// Starts an in-memory MongoDB replica set and the Next dev server against it,
// so e2e tests never touch a real database.
import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = process.env.E2E_PORT ?? "3100";
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    MONGODB_URI: replSet.getUri("todo_e2e"),
    SESSION_SECRET: "e2e-session-secret",
    AUTH_DISABLED: "false",
  },
});

const stop = async () => {
  child.kill();
  await replSet.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", stop);
