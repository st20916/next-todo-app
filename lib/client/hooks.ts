"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import type { GoalItem, PlanItem, TodoItem } from "@/lib/client/types";

export const useCurrentUser = () => useSWR<{ email: string }>("/api/auth/me", fetcher);
export const useTodos = (query = "") => useSWR<TodoItem[]>(`/api/todos${query}`, fetcher);
export const usePlans = (query = "") => useSWR<PlanItem[]>(`/api/weekly-plans${query}`, fetcher);
export const useGoals = () => useSWR<GoalItem[]>("/api/year-goals", fetcher);
export const useGoal = (id: string) => useSWR<GoalItem>(`/api/year-goals/${id}`, fetcher);
export const usePlan = (id: string) => useSWR<PlanItem>(`/api/weekly-plans/${id}`, fetcher);
