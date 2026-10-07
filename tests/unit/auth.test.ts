import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/auth";

beforeEach(() => vi.stubEnv("SESSION_SECRET", "unit-test-secret"));
afterEach(() => vi.unstubAllEnvs());

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword("correct-password", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("salts each hash differently", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  const userId = "64b64b64b64b64b64b64b64b";

  it("round-trips a valid token to its userId", async () => {
    const token = await createSessionToken(userId);
    expect(await verifySessionToken(token)).toBe(userId);
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(userId, Date.now() - 8 * 24 * 3600 * 1000);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a forged signature", async () => {
    const token = await createSessionToken(userId);
    const forged = token.slice(0, -4) + "0000";
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(userId);
    vi.stubEnv("SESSION_SECRET", "a-different-secret");
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects malformed tokens without throwing", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not.enough")).toBeNull();
    expect(await verifySessionToken("1.2.3.4")).toBeNull();
  });
});
