"use client";

import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icons";
import { useCurrentUser } from "@/lib/client/hooks";

interface NavEntry {
  href: string;
  label: string;
  icon: "board" | "calendar" | "flag" | "list" | "inbox";
  /** Overrides active detection for links that differ only by query string. */
  unlinked?: boolean;
}

const groups: { label: string; items: NavEntry[] }[] = [
  {
    label: "관리",
    items: [
      { href: "/board", label: "일일 보드", icon: "board" },
      { href: "/weeks", label: "주간 계획", icon: "calendar" },
      { href: "/goals", label: "1년 목표", icon: "flag" },
    ],
  },
  {
    label: "목록",
    items: [
      { href: "/todos", label: "할 일 목록", icon: "list" },
      { href: "/todos?unlinked=true", label: "미연결 할 일", icon: "inbox", unlinked: true },
    ],
  },
];

const titles: [string, string][] = [
  ["/board", "일일 보드"],
  ["/weeks", "주간 계획"],
  ["/goals", "1년 목표"],
  ["/todos", "할 일 목록"],
];

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const showUnlinked = useSearchParams().get("unlinked") === "true";

  return (
    <nav aria-label="주요 메뉴" className="flex-1 overflow-y-auto px-4 pb-4">
      {groups.map((g) => (
        <div key={g.label} className="mt-1 border-t border-line pt-3 first:border-t-0">
          {!collapsed && <p className="px-3 pb-1 text-xs text-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const base = item.href.split("?")[0];
              const inSection = pathname === base || pathname.startsWith(`${base}/`);
              const active = item.unlinked ? inSection && showUnlinked : inSection && !(base === "/todos" && showUnlinked);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? "bg-primary-soft font-medium text-primary-ink" : "text-fg hover:bg-primary-soft/50"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon name={item.icon} size={18} />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const subscribeTheme = (cb: () => void) => {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable: theme just won't persist */
    }
  }
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-fg hover:bg-primary-soft/50"
    >
      <Icon name={dark ? "sun" : "moon"} size={18} />
    </button>
  );
}

function AccountBadge() {
  const { data } = useCurrentUser();
  const email = data?.email ?? "";
  const initial = email ? email[0].toUpperCase() : "·";

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink">
        {initial}
      </span>
      <div className="leading-tight">
        <p className="max-w-[160px] truncate text-sm font-medium">{email || "내 계정"}</p>
        <p className="text-xs text-muted">로그인됨</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) return <>{children}</>;

  const title = titles.find(([p]) => pathname.startsWith(p))?.[1] ?? "";

  return (
    <div className="flex min-h-screen">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          collapsed ? "lg:w-[84px]" : "lg:w-[254px]"
        } w-[254px] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-[77px] items-center gap-2 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/board" className="flex items-center gap-2 text-xl font-semibold text-primary" aria-label="홈">
            <Icon name="logo" size={26} />
            {!collapsed && <span>할 일 · 목표</span>}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label="사이드바 접기"
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-line hover:bg-primary-soft/50 lg:flex"
            >
              <Icon name="panel" size={18} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="사이드바 펼치기"
            className="mx-auto mb-2 hidden h-10 w-10 items-center justify-center rounded-lg border border-line hover:bg-primary-soft/50 lg:flex"
          >
            <Icon name="panel" size={18} />
          </button>
        )}
        <Suspense fallback={<div className="flex-1" />}>
          <SidebarNav collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[77px] items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line lg:hidden"
          >
            <Icon name="menu" size={18} />
          </button>
          <p className="text-sm text-fg">{title}</p>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <AccountBadge />
            <form action="/api/auth/logout" method="post">
              <button
                aria-label="로그아웃"
                title="로그아웃"
                className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-primary-soft/50"
              >
                <Icon name="logout" size={16} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
