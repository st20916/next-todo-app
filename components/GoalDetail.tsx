"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { useGoal, usePlans } from "@/lib/client/hooks";
import type { GoalItem } from "@/lib/client/types";
import { btnCls, ConfirmDialog, Empty, ErrorBanner, inputCls, Loading, primaryBtnCls, ProgressBar } from "@/components/ui";

function EditGoal({ goal, onDone }: { goal: GoalItem; onDone: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [year, setYear] = useState(goal.year);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await request("PATCH", `/api/year-goals/${goal.id}`, { title, description, year });
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
      <label className="block text-sm">
        연도
        <input type="number" className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </label>
      <label className="block text-sm">
        설명
        <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onDone}>
          취소
        </button>
        <button className={primaryBtnCls} disabled={!title.trim()}>
          저장
        </button>
      </div>
    </form>
  );
}

export function GoalDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: goal, error, isLoading } = useGoal(id);
  const { data: unlinkedPlans = [] } = usePlans("?unlinked=true");
  const [editing, setEditing] = useState(false);
  const [impact, setImpact] = useState<{ weeklyPlans: number; todos: number } | null>(null);
  const [attach, setAttach] = useState("");
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

  async function askDelete() {
    try {
      setImpact(await request("GET", `/api/year-goals/${id}/impact`));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function confirmDelete() {
    await run(async () => {
      await request("DELETE", `/api/year-goals/${id}`);
      router.push("/goals");
    });
    setImpact(null);
  }

  if (isLoading) return <Loading />;
  if (error || !goal) return <ErrorBanner message={error ? errorMessage(error) : "목표를 찾을 수 없습니다."} />;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/goals" className="underline">
          ← 1년 목표
        </Link>
      </p>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-medium">{goal.title}</h1>
          <p className="text-sm text-muted">
            {goal.year}년{goal.description ? ` · ${goal.description}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btnCls} onClick={() => setEditing((v) => !v)}>
            수정
          </button>
          <button className={btnCls} onClick={askDelete}>
            삭제
          </button>
        </div>
      </div>
      {editing && <EditGoal goal={goal} onDone={() => setEditing(false)} />}
      <ErrorBanner message={actionError} onClose={() => setActionError(null)} />

      <div className="mb-6 rounded-2xl border border-line p-4">
        <ProgressBar progress={goal.progress} label="목표 진행률 (연결된 모든 할 일 기준)" />
      </div>

      <h2 className="mb-2 font-medium">연결된 주간 계획 ({goal.weeklyPlans?.length ?? 0})</h2>
      {goal.weeklyPlans?.length ? (
        <ul className="mb-4 space-y-2">
          {goal.weeklyPlans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <div className="min-w-40 flex-1">
                <Link href={`/weeks/${p.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">
                  {p.startDate} ~ {p.endDate}
                </p>
              </div>
              <div className="w-48">
                <ProgressBar progress={p.progress} />
              </div>
              <button className={btnCls} onClick={() => run(() => request("PATCH", `/api/weekly-plans/${p.id}`, { yearGoalId: null }))}>
                연결 해제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>연결된 주간 계획이 없습니다.</Empty>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} max-w-xs`} aria-label="연결할 주간 계획" value={attach} onChange={(e) => setAttach(e.target.value)}>
          <option value="">미연결 주간 계획 선택…</option>
          {unlinkedPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.startDate} ~ {p.endDate})
            </option>
          ))}
        </select>
        <button
          className={btnCls}
          disabled={!attach}
          onClick={() => run(async () => { await request("PATCH", `/api/weekly-plans/${attach}`, { yearGoalId: id }); setAttach(""); })}
        >
          이 목표에 연결
        </button>
        <Link className={btnCls} href="/weeks">
          주간 계획 만들기
        </Link>
      </div>

      {impact && (
        <ConfirmDialog
          title="1년 목표 삭제"
          message={
            <>
              <p>“{goal.title}”을(를) 삭제합니다.</p>
              <p className="mt-2">
                연결된 주간 계획 <b>{impact.weeklyPlans}개</b>(할 일 <b>{impact.todos}개</b>)는 삭제되지 않고 <b>연결만 해제</b>됩니다.
              </p>
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setImpact(null)}
        />
      )}
    </div>
  );
}
