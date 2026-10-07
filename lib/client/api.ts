import { mutate } from "swr";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiClientError(res.status, e.code ?? "ERROR", e.message ?? `요청 실패 (${res.status})`, e);
  }
  return data as T;
}

export const fetcher = <T>(url: string) => request<T>("GET", url);

/** Re-fetches every cached API response (todos, plans and goals carry derived progress). */
export const revalidateAll = () => mutate((key) => typeof key === "string" && key.startsWith("/api/"));

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "알 수 없는 오류");
