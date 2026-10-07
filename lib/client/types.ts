export type Status = "todo" | "doing" | "done";
export const STATUSES: Status[] = ["todo", "doing", "done"];
export const STATUS_LABEL: Record<Status, string> = { todo: "할 일", doing: "진행 중", done: "완료" };

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  date: string | null;
  status: Status;
  position: number;
  weeklyPlanId: string | null;
}

export interface PlanItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  yearGoalId: string | null;
  progress: Progress;
}

export interface GoalItem {
  id: string;
  title: string;
  description: string;
  year: number;
  weeklyPlanCount: number;
  progress: Progress;
  weeklyPlans?: PlanItem[];
}
