"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { mondayOf, sundayOf, todayLocal } from "@/lib/client/dates";
import { useGoals, usePlans } from "@/lib/client/hooks";
import { btnCls, Empty, ErrorBanner, inputCls, Loading, PageHeader, primaryBtnCls, ProgressBar } from "@/components/ui";
import { ProgressChart } from "@/components/ProgressChart";

function NewPlanForm({ onDone }: { onDone: () => void }) {
  const { data: goals = [] } = useGoals();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() => mondayOf(todayLocal()));
  const [endDate, setEndDate] = useState(() => sundayOf(todayLocal()));
  const [yearGoalId, setYearGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request("POST", "/api/weekly-plans", { title, startDate, endDate, yearGoalId: yearGoalId || null });
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
      <label className="block text-sm">
        제목 *
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
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
        <button className={primaryBtnCls} disabled={busy || !title.trim() || startDate > endDate}>
          계획 만들기
        </button>
      </div>
    </form>
  );
}

export function WeeksView() {
  const { data: plans, isLoading, error } = usePlans();
  const { data: goals = [] } = useGoals();
  const [creating, setCreating] = useState(false);
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));

  return (
    <div>
      <PageHeader
        title="주간 계획"
        subtitle="주 단위 계획과 완료율을 한눈에 확인합니다."
        actions={
          <button className={primaryBtnCls} onClick={() => setCreating(true)} disabled={creating}>
            + 주간 계획
          </button>
        }
      />
      {creating && <NewPlanForm onDone={() => setCreating(false)} />}
      <ErrorBanner message={error ? errorMessage(error) : null} />
      {isLoading ? (
        <Loading />
      ) : !plans?.length ? (
        <Empty>아직 주간 계획이 없습니다.</Empty>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
                <div className="min-w-48 flex-1">
                  <Link href={`/weeks/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {p.startDate} ~ {p.endDate} · {p.yearGoalId ? `🎯 ${goalTitle.get(p.yearGoalId) ?? "목표"}` : "1년 목표 미연결"}
                  </p>
                </div>
                <div className="w-56">
                  <ProgressBar progress={p.progress} />
                </div>
              </li>
            ))}
          </ul>
          <ProgressChart title="주간 진행률" data={plans.map((p) => ({ name: p.title, percent: p.progress.percent }))} />
        </div>
      )}
    </div>
  );
}
