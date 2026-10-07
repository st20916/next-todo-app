/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (req: Request, ctx: any) => Promise<Response>;

export async function call(handler: Handler, method: string, body?: unknown, id?: string, query = "") {
  const req = new Request(`http://localhost/api/test${query}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler(req, { params: Promise.resolve({ id }) });
  return { status: res.status, body: (await res.json()) as any };
}
