import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1
} as const;

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function digestOpaqueToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function opaqueTokenMatches(rawValue: string, expectedDigest: string): boolean {
  const actual = Buffer.from(digestOpaqueToken(rawValue), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function createDummyPasswordHash(): Promise<string> {
  return hashPassword("CodeLift dummy password path only");
}
