import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { emailLoginCodeSchema } from "@codelift/contracts";

type RandomInt = (minimum: number, maximum: number) => number;

export function generateLoginCode(randomIntImplementation: RandomInt = randomInt): string {
  const value = randomIntImplementation(0, 1_000_000);
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1_000_000) {
    throw new Error("Secure login-code generation returned an out-of-range value.");
  }
  return value.toString().padStart(6, "0");
}

export function digestLoginCode(input: {
  readonly pepper: Buffer;
  readonly recordIdHex: string;
  readonly code: string;
}): string {
  if (input.pepper.length !== 32) {
    throw new Error("Login-code HMAC requires a 32-byte pepper.");
  }
  if (!/^[0-9a-f]{24}$/i.test(input.recordIdHex)) {
    throw new Error("Login-code HMAC requires one internal record identifier.");
  }
  const code = emailLoginCodeSchema.parse(input.code);
  return createHmac("sha256", input.pepper)
    .update(`codelift:email-login:v1:${input.recordIdHex.toLowerCase()}:${code}`, "utf8")
    .digest("hex");
}

export function loginCodeMatches(expectedDigest: string, actualDigest: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedDigest) || !/^[0-9a-f]{64}$/i.test(actualDigest)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expectedDigest, "hex"), Buffer.from(actualDigest, "hex"));
}
