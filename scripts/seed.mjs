// Seeds a demo goal, a weekly plan for the current week and a few todos for one member.
// Usage: npm run seed -- <email>   (reads MONGODB_URI from .env.local; the member must already exist)
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env.local scripts/seed.mjs <email>");
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run seed -- <email>  (register that account first)");
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const day = (offset) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + offset);
  return fmt(d);
};

await mongoose.connect(uri, { maxPoolSize: 2 });
const db = mongoose.connection.db;

const user = await db.collection("users").findOne({ email });
if (!user) {
  console.error(`No user with email ${email}. Register that account in the app first.`);
  await mongoose.disconnect();
  process.exit(1);
}
const userId = user._id;
const stamp = { createdAt: now, updatedAt: now };

const goal = await db.collection("yeargoals").insertOne({
  title: "데모: 올해의 목표", description: "시드 데이터", year: now.getFullYear(), userId, ...stamp,
});
const plan = await db.collection("weeklyplans").insertOne({
  title: "데모: 이번 주", startDate: day(0), endDate: day(6), yearGoalId: goal.insertedId, userId, ...stamp,
});
const todos = [
  ["기획 정리", "done", 0], ["API 점검", "doing", 0], ["문서 작성", "todo", 0], ["회고", "todo", 1],
];
const today = fmt(now);
await db.collection("todos").insertMany(
  todos.map(([title, status, position]) => ({
    title, description: "", date: today >= day(0) && today <= day(6) ? today : day(0),
    status, position, weeklyPlanId: plan.insertedId, userId, ...stamp,
  })),
);
console.log(`seeded for ${email}: 1 goal, 1 weekly plan, 4 todos`);
await mongoose.disconnect();
