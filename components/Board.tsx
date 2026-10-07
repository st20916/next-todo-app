"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/dates";
import { usePlans, useTodos } from "@/lib/client/hooks";
import { applyMove, dropTarget } from "@/lib/client/optimistic";
import { STATUSES, STATUS_LABEL, type Status, type TodoItem } from "@/lib/client/types";
import { addDays } from "@/lib/period";
import { TodoForm } from "@/components/TodoForm";
import { calcProgress } from "@/lib/progress";
import { btnCls, ConfirmDialog, Empty, ErrorBanner, inputCls, Loading, primaryBtnCls, StatStrip } from "@/components/ui";

const STATUS_DOT: Record<Status, string> = { todo: "bg-muted", doing: "bg-primary", done: "bg-success" };

function Card({
  todo,
  planTitle,
  onEdit,
  onDelete,
  overlay,
}: {
  todo: TodoItem;
  planTitle?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <li
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      aria-label={`${todo.title} (${STATUS_LABEL[todo.status]})`}
      className="cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm active:cursor-grabbing"
    >
      <p className="text-sm font-medium break-words">{todo.title}</p>
      {todo.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{todo.description}</p>}
      <p className="mt-1 text-xs text-muted">{planTitle ? `🗓 ${planTitle}` : "주간 계획 미연결"}</p>
      {!overlay && (
        <div className="mt-2 flex gap-2">
          <button className="text-xs text-muted hover:text-primary-ink" onClick={onEdit}>
            수정
          </button>
          <button className="text-xs text-muted hover:text-danger" onClick={onDelete}>
            삭제
          </button>
        </div>
      )}
    </li>
  );
}

function Column({
  status,
  todos,
  planTitles,
  onEdit,
  onDelete,
}: {
  status: Status;
  todos: TodoItem[];
  planTitles: Map<string, string>;
  onEdit: (t: TodoItem) => void;
  onDelete: (t: TodoItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      aria-label={STATUS_LABEL[status]}
      className={`flex min-h-48 flex-col rounded-2xl border p-3 ${isOver ? "border-primary bg-primary-soft/40" : "border-line bg-surface-alt"}`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
        {STATUS_LABEL[status]} <span className="font-normal text-muted">({todos.length})</span>
      </h2>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex flex-1 flex-col gap-2">
          {todos.map((t) => (
            <Card
              key={t.id}
              todo={t}
              planTitle={t.weeklyPlanId ? planTitles.get(t.weeklyPlanId) : undefined}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

export function Board({ date }: { date?: string }) {
  const router = useRouter();
  const { data, isLoading, error: loadError, mutate } = useTodos(date ? `?date=${date}` : "?date=none");
  const { data: plans = [] } = usePlans();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TodoItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<TodoItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!date) router.replace(`/board?date=${todayLocal()}`);
  }, [date, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const todos = useMemo(() => data ?? [], [data]);
  const planTitles = useMemo(() => new Map(plans.map((p) => [p.id, p.title])), [plans]);
  const columns = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((s) => [s, todos.filter((t) => t.status === s).sort((a, b) => a.position - b.position)]),
      ) as Record<Status, TodoItem[]>,
    [todos],
  );
  const active = todos.find((t) => t.id === activeId) ?? null;
  const unfinished = todos.filter((t) => t.status !== "done").length;

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const target = dropTarget(todos, id, String(e.over.id));
    if (!target) return;
    setError(null);
    try {
      await mutate(
        async () => {
          await request("PATCH", `/api/todos/${id}/move`, target);
          return undefined as never;
        },
        {
          optimisticData: (cur) => applyMove(cur ?? [], id, target.status, target.position),
          rollbackOnError: true,
          populateCache: false,
          revalidate: false,
        },
      );
    } catch (err) {
      setError(`이동에 실패해 원래대로 되돌렸습니다: ${errorMessage(err)}`);
    }
    await revalidateAll();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request("DELETE", `/api/todos/${deleting.id}`);
      await revalidateAll();
      setDeleting(null);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(null);
    }
    setBusy(false);
  }

  async function carryOver() {
    if (!date) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await request<{ moved: number; unlinked: number; nextDate: string }>("POST", "/api/todos/carry-over", { date });
      setNotice(
        `${r.moved}개를 ${r.nextDate}로 이월했습니다.` +
          (r.unlinked ? ` 주간 계획 기간을 벗어난 ${r.unlinked}개는 연결이 해제되어 미연결 목록으로 이동했습니다.` : ""),
      );
      await revalidateAll();
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  if (!date) return <Loading />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link className={btnCls} href={`/board?date=${addDays(date, -1)}`} aria-label="이전 날">
          ←
        </Link>
        <input
          type="date"
          aria-label="날짜 선택"
          className={inputCls.replace("w-full", "w-auto")}
          value={date}
          onChange={(e) => e.target.value && router.push(`/board?date=${e.target.value}`)}
        />
        <Link className={btnCls} href={`/board?date=${addDays(date, 1)}`} aria-label="다음 날">
          →
        </Link>
        <Link className={btnCls} href={`/board?date=${todayLocal()}`}>
          오늘
        </Link>
        <div className="ml-auto flex gap-2">
          <button className={btnCls} onClick={carryOver} disabled={busy || unfinished === 0}>
            미완료 {unfinished}개 다음 날로 이월
          </button>
          <button className={primaryBtnCls} onClick={() => setEditing("new")}>
            + 할 일
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? (loadError ? errorMessage(loadError) : null)} onClose={() => setError(null)} />
      {notice && (
        <p role="status" className="mb-3 rounded border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <StatStrip
            items={[
              { label: "전체 할 일", value: todos.length, hint: "이 날짜의 할 일" },
              { label: "진행 중", value: columns.doing.length, hint: "지금 하고 있는 일", tone: "primary" },
              { label: "완료", value: columns.done.length, hint: "오늘 끝낸 일", tone: "success" },
              { label: "달성률", value: `${calcProgress(columns.done.length, todos.length).percent}%`, hint: "완료 ÷ 전체" },
            ]}
          />
          {todos.length === 0 && <Empty>이 날짜에 할 일이 없습니다. “+ 할 일”로 추가해 보세요.</Empty>}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={onDragEnd}
          >
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {STATUSES.map((s) => (
                <Column key={s} status={s} todos={columns[s]} planTitles={planTitles} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </div>
            <DragOverlay>{active ? <Card todo={active} overlay /> : null}</DragOverlay>
          </DndContext>
        </>
      )}

      {editing && (
        <TodoForm
          key={editing === "new" ? "new" : editing.id}
          todo={editing === "new" ? undefined : editing}
          defaultDate={date}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="할 일 삭제"
          message={`“${deleting.title}”을(를) 삭제할까요? 연결된 주간 계획의 진행률이 다시 계산됩니다.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
