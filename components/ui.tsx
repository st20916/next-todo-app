"use client";

import { useEffect, type ReactNode } from "react";
import type { Progress } from "@/lib/client/types";

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
export const btnCls =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-primary-soft/50 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryBtnCls =
  "inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(27,27,31,0.08)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtnCls =
  "inline-flex items-center justify-center rounded-lg bg-danger px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const cardCls = "rounded-2xl border border-line bg-surface";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-medium">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** KPI cards joined into one bordered strip, like the reference dashboard. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: string; tone?: "primary" | "success" | "danger" }[] }) {
  const tone = { primary: "text-primary-ink", success: "text-success", danger: "text-danger" };
  return (
    <div className={`${cardCls} mb-5 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line sm:[&>*:nth-child(n+3)]:border-t-0`}>
      {items.map((it) => (
        <div key={it.label} className="p-5">
          <p className="text-base font-medium">{it.label}</p>
          <p className={`mt-4 text-3xl font-medium ${it.tone ? tone[it.tone] : ""}`}>{it.value}</p>
          {it.hint && <p className="mt-1 text-xs text-muted">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-medium">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "삭제",
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="mb-5 text-sm text-muted">{message}</div>
      <div className="flex justify-end gap-2">
        <button className={btnCls} onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button className={dangerBtnCls} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ProgressBar({ progress, label }: { progress: Progress; label?: string }) {
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
        <span>{label ?? "진행률"}</span>
        <span>
          <b className="text-sm font-medium text-fg">{progress.percent}%</b> · {progress.done}/{progress.total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label ?? "진행률"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 overflow-hidden rounded-full bg-primary-soft"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-3 flex items-start justify-between rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      <span>{message}</span>
      {onClose && (
        <button aria-label="닫기" className="ml-3" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-surface-alt p-8 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>;
}
