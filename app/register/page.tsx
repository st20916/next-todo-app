"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, request } from "@/lib/client/api";
import { ErrorBanner, inputCls, primaryBtnCls } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("POST", "/api/auth/register", { email, password });
      router.replace("/board");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-2xl border border-line p-6">
      <h1 className="text-2xl font-medium">회원가입</h1>
      <ErrorBanner message={error} />
      <label className="block text-sm">
        이메일
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required autoComplete="email" />
      </label>
      <label className="block text-sm">
        비밀번호
        <input
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <label className="block text-sm">
        비밀번호 확인
        <input
          type="password"
          className={inputCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <button className={`${primaryBtnCls} w-full`} disabled={busy || !email || !password || !confirm}>
        가입하기
      </button>
      <p className="text-center text-sm text-muted">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="text-primary underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
