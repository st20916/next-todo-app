"use client";

import { useState, type FormEvent } from "react";
import { errorMessage, request, revalidateAll } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/dates";
import { usePlans } from "@/lib/client/hooks";
import type { TodoItem } from "@/lib/client/types";
import { isFutureDate, isWithinPeriod } from "@/lib/period";
import { btnCls, ErrorBanner, inputCls, Modal, primaryBtnCls } from "@/components/ui";

export function TodoForm({
  todo,
  defaultDate,
  defaultPlanId,
  onClose,
}: {
  todo?: TodoItem;
  defaultDate?: string;
  defaultPlanId?: string;
  onClose: () => void;
}) {
  const { data: plans = [] } = usePlans();
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [date, setDate] = useState(todo ? (todo.date ?? "") : (defaultDate ?? ""));
  const [planId, setPlanId] = useState(todo?.weeklyPlanId ?? defaultPlanId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = plans.find((p) => p.id === planId);
  const mismatch = selected && date && !isWithinPeriod(date, selected.startDate, selected.endDate);
  const today = todayLocal();
  const futureDate = !!date && isFutureDate(date, today);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { title, description, date: date || null, weeklyPlanId: planId || null };
    try {
      if (todo) await request("PATCH", `/api/todos/${todo.id}`, payload);
      else await request("POST", "/api/todos", payload);
      await revalidateAll();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={todo ? "할 일 수정" : "할 일 추가"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBanner message={error} />
        <label className="block text-sm">
          제목 *
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
        </label>
        <label className="block text-sm">
          설명
          <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block text-sm">
          날짜
          <input type="date" className={inputCls} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        {futureDate && <p className="text-sm text-warning">오늘 이후 날짜는 선택할 수 없습니다.</p>}
        <label className="block text-sm">
          주간 계획
          <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">연결 안 함</option>
            {plans.map((p) => {
              const outside = !!date && !isWithinPeriod(date, p.startDate, p.endDate);
              return (
                <option key={p.id} value={p.id} disabled={outside}>
                  {p.title} ({p.startDate} ~ {p.endDate}){outside ? " · 기간 밖" : ""}
                </option>
              );
            })}
          </select>
        </label>
        {mismatch && (
          <p className="text-sm text-warning">선택한 날짜가 주간 계획 기간 밖입니다. 날짜를 바꾸거나 연결을 해제하세요.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnCls} onClick={onClose} disabled={busy}>
            취소
          </button>
          <button type="submit" className={primaryBtnCls} disabled={busy || !title.trim() || !!mismatch || futureDate}>
            {todo ? "저장" : "추가"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
