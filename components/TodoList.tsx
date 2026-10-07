"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { filtersToQuery, type TodoFilters } from "@/lib/client/filters";
import { useGoals, usePlans, useTodos } from "@/lib/client/hooks";
import { STATUSES, STATUS_LABEL, type TodoItem } from "@/lib/client/types";
import { TodoForm } from "@/components/TodoForm";
import { btnCls, ConfirmDialog, Empty, ErrorBanner, inputCls, Loading, PageHeader, primaryBtnCls } from "@/components/ui";

function FilterForm({ filters }: { filters: TodoFilters }) {
  const router = useRouter();
  const { data: goals = [] } = useGoals();
  const [draft, setDraft] = useState<TodoFilters>(filters);

  function apply(e: FormEvent) {
    e.preventDefault();
    router.push(`/todos${filtersToQuery(draft)}`);
  }

  return (
    <form onSubmit={apply} className="mb-4 grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm">
        상태
        <select className={inputCls} value={draft.status ?? ""} onChange={(e) => setDraft({ ...draft, status: (e.target.value || undefined) as TodoFilters["status"] })}>
          <option value="">전체</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        시작일
        <input type="date" className={inputCls} value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })} />
      </label>
      <label className="text-sm">
        종료일
        <input type="date" className={inputCls} value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })} />
      </label>
      <label className="text-sm">
        1년 목표
        <select
          className={inputCls}
          value={draft.yearGoalId ?? ""}
          disabled={draft.unlinked}
          onChange={(e) => setDraft({ ...draft, yearGoalId: e.target.value || undefined })}
        >
          <option value="">전체</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={!!draft.unlinked} onChange={(e) => setDraft({ ...draft, unlinked: e.target.checked || undefined })} />
          미연결만
        </label>
        <button className={primaryBtnCls}>적용</button>
        <Link href="/todos" className={btnCls}>
          초기화
        </Link>
      </div>
    </form>
  );
}

export function TodoList({ filters }: { filters: TodoFilters }) {
  const query = filtersToQuery(filters);
  const { data: todos, isLoading, error } = useTodos(query);
  const { data: plans = [] } = usePlans();
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [deleting, setDeleting] = useState<TodoItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const planTitle = new Map(plans.map((p) => [p.id, p.title]));

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await request("DELETE", `/api/todos/${deleting.id}`);
      await revalidateAll();
    } catch (err) {
      setActionError(errorMessage(err));
    }
    setDeleting(null);
  }

  return (
    <div>
      <PageHeader
        title={filters.unlinked ? "미연결 할 일" : "할 일 목록"}
        subtitle={filters.unlinked ? "주간 계획에 연결되지 않은 할 일입니다." : "상태, 기간, 목표로 필터링할 수 있습니다."}
      />
      <FilterForm key={query} filters={filters} />
      <ErrorBanner message={actionError ?? (error ? errorMessage(error) : null)} onClose={() => setActionError(null)} />
      {isLoading ? (
        <Loading />
      ) : !todos?.length ? (
        <Empty>{query ? "조건에 맞는 할 일이 없습니다." : "할 일이 없습니다."}</Empty>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <div className="min-w-48 flex-1">
                <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted" : ""}`}>{t.title}</p>
                <p className="text-xs text-muted">
                  {t.date ? <Link href={`/board?date=${t.date}`} className="underline">{t.date}</Link> : "날짜 없음"} · {STATUS_LABEL[t.status]} ·{" "}
                  {t.weeklyPlanId ? (planTitle.get(t.weeklyPlanId) ?? "주간 계획") : "주간 계획 미연결"}
                </p>
              </div>
              <button className={btnCls} onClick={() => setEditing(t)}>
                수정
              </button>
              <button className={btnCls} onClick={() => setDeleting(t)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <TodoForm key={editing.id} todo={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="할 일 삭제"
          message={`“${deleting.title}”을(를) 삭제할까요?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
