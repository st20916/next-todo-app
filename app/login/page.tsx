"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, request } from "@/lib/client/api";
import { ErrorBanner, inputCls, primaryBtnCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request("POST", "/api/auth/login", { email, password });
      router.replace("/board");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-2xl border border-line p-6">
      <h1 className="text-2xl font-medium">로그인</h1>
      <ErrorBanner message={error} />
      <label className="block text-sm">
        이메일
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required autoComplete="email" />
      </label>
      <label className="block text-sm">
        비밀번호
        <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </label>
      <button className={`${primaryBtnCls} w-full`} disabled={busy || !email || !password}>
        로그인
      </button>
      <p className="text-center text-sm text-muted">
        계정이 없나요?{" "}
        <Link href="/register" className="text-primary underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
