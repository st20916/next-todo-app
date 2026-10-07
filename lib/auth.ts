/**
 * Per-member auth. Each member registers with email + password (PBKDF2 hash,
 * stored on `User`), and the session cookie carries a signed `(exp, userId)`
 * pair (`<exp>.<userId>.<hmac>`). Uses Web Crypto only, so it runs in both the
 * proxy and Route Handlers.
 */
export const SESSION_COOKIE = "todo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // seconds
const PBKDF2_ITERATIONS = 100_000;

/** Fixed user id used only when AUTH_DISABLED bypasses login (dev/tests, never production). */
export const DEV_USER_ID = "000000000000000000000001";

const encoder = new TextEncoder();
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const secret = () => process.env.SESSION_SECRET || "";

/** Test/dev escape hatch. Never honoured in production. */
export const authDisabled = () => process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";

/** A deployment without SESSION_SECRET must never serve data or issue sessions. */
export const authConfigured = () => !!process.env.SESSION_SECRET;

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, encoder.encode(message));
  return toHex(sig);
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PBKDF2-SHA256, stored as `pbkdf2$<iterations>$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(parts[2]), iterations, hash: "SHA-256" }, key, 256);
  return safeEqual(toHex(bits), parts[3]);
}

export async function createSessionToken(userId: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE;
  const payload = `${exp}.${userId}`;
  return `${payload}.${await hmacHex(secret(), payload)}`;
}

/** Returns the session's userId, or null if the token is missing, malformed, expired or forged. */
export async function verifySessionToken(token: string | undefined | null, nowMs = Date.now()): Promise<string | null> {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [exp, userId, sig] = parts;
  if (!exp || !userId || !sig || !/^\d+$/.test(exp) || Number(exp) <= Math.floor(nowMs / 1000)) return null;
  if (!OBJECT_ID_RE.test(userId)) return null;
  const payload = `${exp}.${userId}`;
  return safeEqual(sig, await hmacHex(secret(), payload)) ? userId : null;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k !== name) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return undefined; // malformed cookie: treat as absent
    }
  }
  return undefined;
}

/** Resolves the current request's member id, or null when not logged in. */
export async function getSessionUserId(req: Request): Promise<string | null> {
  if (authDisabled()) return DEV_USER_ID;
  if (!authConfigured()) return null;
  return verifySessionToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  return (await getSessionUserId(req)) !== null;
}
