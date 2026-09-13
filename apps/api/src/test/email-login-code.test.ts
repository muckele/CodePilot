import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  digestLoginCode,
  generateLoginCode,
  loginCodeMatches
} from "../account/email-login-code.js";

describe("email login-code cryptography", () => {
  it.each([
    [0, "000000"],
    [1, "000001"],
    [999_999, "999999"]
  ])("generates secure fixed-width code %s as %s", (randomValue, expected) => {
    const randomInt = vi.fn((_minimum: number, _maximum: number) => randomValue);

    expect(generateLoginCode(randomInt)).toBe(expected);
    expect(randomInt).toHaveBeenCalledOnce();
    expect(randomInt).toHaveBeenCalledWith(0, 1_000_000);
  });

  it("uses the approved record-bound HMAC-SHA-256 context", () => {
    const pepper = Buffer.alloc(32, 0x2a);
    const recordIdHex = "64f0000000000000000000a1";
    const code = "001204";
    const expected = createHmac("sha256", pepper)
      .update(`codelift:email-login:v1:${recordIdHex}:${code}`, "utf8")
      .digest("hex");

    const digest = digestLoginCode({ pepper, recordIdHex, code });
    expect(digest).toBe(expected);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(code);
    expect(
      digestLoginCode({
        pepper,
        recordIdHex: "64f0000000000000000000a2",
        code
      })
    ).not.toBe(digest);
    expect(digestLoginCode({ pepper: Buffer.alloc(32, 0x2b), recordIdHex, code })).not.toBe(digest);
    expect(digestLoginCode({ pepper, recordIdHex, code: "001205" })).not.toBe(digest);
  });

  it("compares only fixed-size digests and rejects malformed values", () => {
    const digest = digestLoginCode({
      pepper: Buffer.alloc(32, 0x2a),
      recordIdHex: "64f0000000000000000000a1",
      code: "001204"
    });

    expect(loginCodeMatches(digest, digest)).toBe(true);
    expect(loginCodeMatches(digest, `${"0".repeat(63)}1`)).toBe(false);
    expect(loginCodeMatches(digest, "not-a-digest")).toBe(false);
    expect(loginCodeMatches(digest, "0".repeat(62))).toBe(false);
  });

  it("rejects invalid code, record, or pepper inputs", () => {
    expect(() =>
      digestLoginCode({
        pepper: Buffer.alloc(31),
        recordIdHex: "64f0000000000000000000a1",
        code: "001204"
      })
    ).toThrow();
    expect(() =>
      digestLoginCode({ pepper: Buffer.alloc(32), recordIdHex: "not-an-id", code: "001204" })
    ).toThrow();
    expect(() =>
      digestLoginCode({
        pepper: Buffer.alloc(32),
        recordIdHex: "64f0000000000000000000a1",
        code: "12345x"
      })
    ).toThrow();
  });
});
