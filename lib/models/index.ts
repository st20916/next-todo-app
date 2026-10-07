import mongoose, { Schema, type Model } from "mongoose";
import { TODO_STATUSES } from "@/lib/validation/schemas";

const toJSON = {
  versionKey: false as const,
  transform(_doc: unknown, ret: Record<string, unknown>) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.userId;
    for (const key of ["weeklyPlanId", "yearGoalId"]) {
      if (ret[key] != null) ret[key] = String(ret[key]);
    }
    return ret;
  },
};

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false as const,
      transform(_doc: unknown, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

const yearGoalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    year: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, toJSON },
);
yearGoalSchema.index({ userId: 1 });

const weeklyPlanSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    yearGoalId: { type: Schema.Types.ObjectId, ref: "YearGoal", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, toJSON },
);
weeklyPlanSchema.index({ userId: 1, yearGoalId: 1 });

const todoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    date: { type: String, default: null },
    status: { type: String, enum: TODO_STATUSES, default: "todo", required: true },
    position: { type: Number, default: 0 },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, toJSON },
);
todoSchema.index({ userId: 1, date: 1, status: 1, position: 1 });
todoSchema.index({ userId: 1, weeklyPlanId: 1 });

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const User = model("User", userSchema);
export const YearGoal = model("YearGoal", yearGoalSchema);
export const WeeklyPlan = model("WeeklyPlan", weeklyPlanSchema);
export const Todo = model("Todo", todoSchema);
