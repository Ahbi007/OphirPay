// SPDX-License-Identifier: MIT
/**
 * @vitest-environment node
 *
 * Coverage for the request-level API-key authentication entry points
 * (issue #700): `authenticateRequest`, `requireAuth` and the un-scoped
 * `withApiAuth` variant. The scoped helpers are covered in api-scopes.test.ts;
 * this suite pins the DB lookup, expiry and fail-closed behaviour that an
 * auditor would ask about first.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(() => Promise.resolve()),
  logCreate: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    apiKey: { findFirst: mocks.findFirst, update: mocks.update },
    apiKeyRequestLog: { create: mocks.logCreate },
  },
}));

import {
  authenticateRequest,
  requireAuth,
  withApiAuth,
  hashApiKey,
  hashApiKeyV1,
  deriveKeyPrefix,
} from "@/lib/api-auth";

// Current key format: `oph_` + 32 CSPRNG bytes as lowercase hex (#701). Only
// this shape (and the legacy 24-byte one) is accepted at auth time.
const RAW_KEY = `oph_${"0123456789abcdef".repeat(4)}`;

function requestWithKey(key = RAW_KEY): Request {
  return new Request("http://localhost/api/payments", {
    headers: { authorization: `Bearer ${key}` },
  });
}

function storedKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key_1",
    userId: "user_1",
    name: "CI key",
    expiresAt: null,
    scopes: ["read:payments"],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.findFirst.mockReset();
  mocks.update.mockClear();
  mocks.logCreate.mockClear();
});

describe("authenticateRequest", () => {
  it("returns null when no API key header is present", async () => {
    const result = await authenticateRequest(new Request("http://localhost/api/payments"));
    expect(result).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("looks the key up by prefix and both accepted digests", async () => {
    mocks.findFirst.mockResolvedValue(storedKey());

    const result = await authenticateRequest(requestWithKey());

    expect(result).toEqual({
      userId: "user_1",
      keyId: "key_1",
      keyName: "CI key",
      scopes: ["read:payments"],
    });

    // `in` carries the current `v1:` digest first, then the pre-#701 bare
    // digest, so keys minted before #701 keep authenticating.
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        keyHash: { in: [hashApiKeyV1(RAW_KEY), hashApiKey(RAW_KEY)] },
        prefix: deriveKeyPrefix(RAW_KEY),
      },
      select: { id: true, userId: true, name: true, expiresAt: true, scopes: true },
    });

    // lastUsed / request log are fire-and-forget writes.
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.logCreate).toHaveBeenCalledWith({ data: { keyId: "key_1" } });
  });

  it("rejects malformed key material before touching the database", async () => {
    expect(await authenticateRequest(requestWithKey("oph_livekeyvalue"))).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("defaults a null scopes column to an empty array", async () => {
    mocks.findFirst.mockResolvedValue(storedKey({ scopes: null }));
    const result = await authenticateRequest(requestWithKey());
    expect(result?.scopes).toEqual([]);
  });

  it("rejects an expired key", async () => {
    mocks.findFirst.mockResolvedValue(
      storedKey({ expiresAt: new Date(Date.now() - 60_000) })
    );
    expect(await authenticateRequest(requestWithKey())).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts a key that expires in the future", async () => {
    mocks.findFirst.mockResolvedValue(
      storedKey({ expiresAt: new Date(Date.now() + 60_000) })
    );
    expect(await authenticateRequest(requestWithKey())).not.toBeNull();
  });

  it("returns null for an unknown key", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await authenticateRequest(requestWithKey())).toBeNull();
  });

  it("fails closed when the database is unavailable", async () => {
    mocks.findFirst.mockRejectedValue(new Error("connection refused"));
    expect(await authenticateRequest(requestWithKey())).toBeNull();
  });
});

describe("requireAuth", () => {
  it("returns the user context on success", async () => {
    mocks.findFirst.mockResolvedValue(storedKey());
    const result = await requireAuth(requestWithKey());
    expect(result).toEqual({ userId: "user_1", keyId: "key_1" });
  });

  it("returns a 401 response when the key is missing", async () => {
    const result = await requireAuth(new Request("http://localhost/api/payments"));
    expect("userId" in result).toBe(false);
    if (!("userId" in result)) {
      expect(result.status).toBe(401);
      const body = await result.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("withApiAuth (no required scope)", () => {
  it("returns 401 without invoking the handler when unauthenticated", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withApiAuth(handler);
    const res = await wrapped(new Request("http://localhost/api/payments"));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler and forwards extra arguments when authenticated", async () => {
    mocks.findFirst.mockResolvedValue(storedKey());
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const wrapped = withApiAuth(handler);
    const req = requestWithKey();
    const context = { params: Promise.resolve({ id: "p_1" }) };
    const res = await wrapped(req, context);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(req, context);
  });
});
