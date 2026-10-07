"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/dates";
import { useGoals, usePlan, useTodos } from "@/lib/client/hooks";
import { STATUS_LABEL, type PlanItem, type TodoItem } from "@/lib/client/types";
import { isWithinPeriod } from "@/lib/period";
import { TodoForm } from "@/components/TodoForm";
import { btnCls, ConfirmDialog, Empty, ErrorBanner, inputCls, Loading, primaryBtnCls, ProgressBar } from "@/components/ui";

function EditPlan({ plan, onDone }: { plan: PlanItem; onDone: () => void }) {
  const { data: goals = [] } = useGoals();
  const [title, setTitle] = useState(plan.title);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [endDate, setEndDate] = useState(plan.endDate);
  const [yearGoalId, setYearGoalId] = useState(plan.yearGoalId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await request("PATCH", `/api/weekly-plans/${plan.id}`, { title, startDate, endDate, yearGoalId: yearGoalId || null });
      await revalidateAll();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-line p-4">
      <ErrorBanner message={error} />
      <label className="block text-sm">
        제목 *
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          시작일
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="text-sm">
          종료일
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
      </div>
      <label className="block text-sm">
        1년 목표
        <select className={inputCls} value={yearGoalId} onChange={(e) => setYearGoalId(e.target.value)}>
          <option value="">연결 안 함</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} ({g.year})
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onDone}>
          취소
        </button>
        <button className={primaryBtnCls} disabled={!title.trim() || startDate > endDate}>
          저장
        </button>
      </div>
    </form>
  );
}

export function WeekDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: plan, error, isLoading } = usePlan(id);
  const { data: todos = [] } = useTodos(`?weeklyPlanId=${id}`);
  const { data: goals = [] } = useGoals();
  const [editing, setEditing] = useState(false);
  const [todoForm, setTodoForm] = useState<TodoItem | "new" | null>(null);
  const [impact, setImpact] = useState<{ todos: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      await revalidateAll();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (isLoading) return <Loading />;
  if (error || !plan) return <ErrorBanner message={error ? errorMessage(error) : "주간 계획을 찾을 수 없습니다."} />;

  const goal = goals.find((g) => g.id === plan.yearGoalId);
  const today = todayLocal();
  const defaultDate = isWithinPeriod(today, plan.startDate, plan.endDate) ? today : plan.startDate;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/weeks" className="underline">
          ← 주간 계획
        </Link>
      </p>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-medium">{plan.title}</h1>
          <p className="text-sm text-muted">
            {plan.startDate} ~ {plan.endDate} ·{" "}
            {goal ? (
              <Link href={`/goals/${goal.id}`} className="underline">
                🎯 {goal.title}
              </Link>
            ) : (
              "1년 목표 미연결"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btnCls} onClick={() => setEditing((v) => !v)}>
            수정
          </button>
          <button
            className={btnCls}
            onClick={() =>
              run(async () => setImpact(await request("GET", `/api/weekly-plans/${id}/impact`)))
            }
          >
            삭제
          </button>
        </div>
      </div>
      {editing && <EditPlan plan={plan} onDone={() => setEditing(false)} />}
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <div className="mb-6 rounded-2xl border border-line p-4">
        <ProgressBar progress={plan.progress} label="주간 진행률 (완료 ÷ 전체 할 일)" />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">연결된 할 일 ({todos.length})</h2>
        <button className={primaryBtnCls} onClick={() => setTodoForm("new")}>
          + 할 일
        </button>
      </div>
      {todos.length === 0 ? (
        <Empty>연결된 할 일이 없습니다. 진행률은 0%로 표시됩니다.</Empty>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <div className="min-w-40 flex-1">
                <p className={`text-sm ${t.status === "done" ? "line-through text-muted" : ""}`}>{t.title}</p>
                <p className="text-xs text-muted">
                  {t.date ?? "날짜 없음"} · {STATUS_LABEL[t.status]}
                </p>
              </div>
              <button className={btnCls} onClick={() => setTodoForm(t)}>
                수정
              </button>
              <button className={btnCls} onClick={() => run(() => request("PATCH", `/api/todos/${t.id}`, { weeklyPlanId: null }))}>
                연결 해제
              </button>
            </li>
          ))}
        </ul>
      )}

      {todoForm && (
        <TodoForm
          key={todoForm === "new" ? "new" : todoForm.id}
          todo={todoForm === "new" ? undefined : todoForm}
          defaultDate={defaultDate}
          defaultPlanId={id}
          onClose={() => setTodoForm(null)}
        />
      )}
      {impact && (
        <ConfirmDialog
          title="주간 계획 삭제"
          message={
            <>
              <p>“{plan.title}”을(를) 삭제합니다.</p>
              <p className="mt-2">
                연결된 할 일 <b>{impact.todos}개</b>는 삭제되지 않고 <b>연결만 해제</b>되어 미연결 목록에 남습니다.
              </p>
            </>
          }
          onConfirm={() =>
            run(async () => {
              await request("DELETE", `/api/weekly-plans/${id}`);
              router.push("/weeks");
            }).then(() => setImpact(null))
          }
          onCancel={() => setImpact(null)}
        />
      )}
    </div>
  );
}
