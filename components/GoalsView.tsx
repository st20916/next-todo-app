"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { useGoals } from "@/lib/client/hooks";
import { btnCls, Empty, ErrorBanner, inputCls, Loading, PageHeader, primaryBtnCls, ProgressBar } from "@/components/ui";
import { ProgressChart } from "@/components/ProgressChart";

function NewGoalForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request("POST", "/api/year-goals", { title, description, year });
      await revalidateAll();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-line p-4">
      <ErrorBanner message={error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="text-sm">
          목표 제목 *
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
        </label>
        <label className="text-sm">
          연도
          <input type="number" className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))} min={1970} max={2200} required />
        </label>
      </div>
      <label className="block text-sm">
        설명
        <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onDone}>
          취소
        </button>
        <button className={primaryBtnCls} disabled={busy || !title.trim()}>
          목표 만들기
        </button>
      </div>
    </form>
  );
}

export function GoalsView() {
  const { data: goals, isLoading, error } = useGoals();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="1년 목표"
        subtitle="연결된 주간 계획의 할 일 진행률이 목표 진행률로 합산됩니다."
        actions={
          <button className={primaryBtnCls} onClick={() => setCreating(true)} disabled={creating}>
            + 1년 목표
          </button>
        }
      />
      {creating && <NewGoalForm onDone={() => setCreating(false)} />}
      <ErrorBanner message={error ? errorMessage(error) : null} />
      {isLoading ? (
        <Loading />
      ) : !goals?.length ? (
        <Empty>아직 1년 목표가 없습니다. 첫 목표를 만들어 보세요.</Empty>
      ) : (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {goals.map((g) => (
              <li key={g.id} className="rounded-2xl border border-line p-4">
                <Link href={`/goals/${g.id}`} className="font-medium underline-offset-2 hover:underline">
                  {g.title}
                </Link>
                <p className="mb-3 text-xs text-muted">
                  {g.year}년 · 연결된 주간 계획 {g.weeklyPlanCount}개
                </p>
                <ProgressBar progress={g.progress} label="목표 진행률" />
              </li>
            ))}
          </ul>
          <ProgressChart title="1년 목표 진행률" data={goals.map((g) => ({ name: g.title, percent: g.progress.percent }))} />
        </div>
      )}
    </div>
  );
}
