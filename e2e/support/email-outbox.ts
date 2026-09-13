import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, rename, rm, unlink } from "node:fs/promises";
import { join } from "node:path";

import { E2E_EMAIL_OUTBOX_DIR, guardedE2eEmailOutboxPath } from "./environment.js";

export type E2EEmailMessage =
  | {
      readonly version: 1;
      readonly purpose: "password-reset";
      readonly to: string;
      readonly resetUrl: string;
      readonly expiresAt: string;
    }
  | {
      readonly version: 1;
      readonly purpose: "email-login-code";
      readonly to: string;
      readonly code: string;
      readonly expiresAt: string;
    };

const syntheticRecipient = /^e2e-[a-z0-9][a-z0-9-]*-[a-f0-9]{12}@example\.test$/u;
const messageFile = /^[a-f0-9-]+\.json$/u;

function assertSyntheticRecipient(email: string): void {
  if (!syntheticRecipient.test(email)) {
    throw new Error(
      "Playwright email access requires an explicit synthetic example.test recipient."
    );
  }
}

function parseMessage(value: unknown): E2EEmailMessage {
  if (typeof value !== "object" || value === null) {
    throw new Error("The fake email outbox contained an invalid message.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.to !== "string" ||
    !syntheticRecipient.test(record.to) ||
    typeof record.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(record.expiresAt))
  ) {
    throw new Error("The fake email outbox contained an invalid message envelope.");
  }
  if (
    record.purpose === "password-reset" &&
    typeof record.resetUrl === "string" &&
    Object.keys(record).sort().join(",") === "expiresAt,purpose,resetUrl,to,version"
  ) {
    return record as E2EEmailMessage;
  }
  if (
    record.purpose === "email-login-code" &&
    typeof record.code === "string" &&
    /^[0-9]{6}$/u.test(record.code) &&
    Object.keys(record).sort().join(",") === "code,expiresAt,purpose,to,version"
  ) {
    return record as E2EEmailMessage;
  }
  throw new Error("The fake email outbox contained an invalid or over-broad message payload.");
}

async function ensurePrivateDirectory(): Promise<string> {
  const directory = guardedE2eEmailOutboxPath(E2E_EMAIL_OUTBOX_DIR);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
    throw new Error("The Playwright email outbox directory is not private.");
  }
  return directory;
}

async function availableMessages(directory: string): Promise<
  readonly {
    readonly path: string;
    readonly message: E2EEmailMessage;
  }[]
> {
  const files = (await readdir(directory)).filter((file) => messageFile.test(file)).sort();
  const messages = [];
  for (const file of files) {
    const path = join(directory, file);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
      throw new Error("The Playwright email outbox contained a non-private message file.");
    }
    const message = parseMessage(JSON.parse(await readFile(path, "utf8")) as unknown);
    messages.push({ path, message });
  }
  return messages;
}

export async function resetE2EEmailOutbox(): Promise<void> {
  const directory = guardedE2eEmailOutboxPath(E2E_EMAIL_OUTBOX_DIR);
  await rm(directory, { recursive: true, force: true });
  await ensurePrivateDirectory();
}

export async function removeE2EEmailOutbox(): Promise<void> {
  const directory = guardedE2eEmailOutboxPath(E2E_EMAIL_OUTBOX_DIR);
  await rm(directory, { recursive: true, force: true });
}

export async function consumeE2EEmail<Purpose extends E2EEmailMessage["purpose"]>(options: {
  readonly purpose: Purpose;
  readonly to: string;
  readonly timeoutMs?: number;
}): Promise<Extract<E2EEmailMessage, { purpose: Purpose }>> {
  assertSyntheticRecipient(options.to);
  const directory = await ensurePrivateDirectory();
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);

  while (Date.now() <= deadline) {
    const messages = await availableMessages(directory);
    const candidate = messages.find(
      ({ message }) => message.purpose === options.purpose && message.to === options.to
    );
    if (candidate !== undefined) {
      const claimedPath = join(directory, `.consume-${process.pid}-${randomUUID()}`);
      try {
        await rename(candidate.path, claimedPath);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      try {
        const consumed = parseMessage(JSON.parse(await readFile(claimedPath, "utf8")) as unknown);
        if (consumed.purpose !== options.purpose || consumed.to !== options.to) {
          throw new Error("The claimed fake email did not match the requested synthetic message.");
        }
        return consumed as Extract<E2EEmailMessage, { purpose: Purpose }>;
      } finally {
        await unlink(claimedPath).catch(() => undefined);
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`Timed out waiting for one ${options.purpose} fake email.`);
}

export async function expectNoE2EEmail(options: {
  readonly purpose: E2EEmailMessage["purpose"];
  readonly to: string;
  readonly waitMs?: number;
}): Promise<void> {
  assertSyntheticRecipient(options.to);
  const directory = await ensurePrivateDirectory();
  const deadline = Date.now() + (options.waitMs ?? 900);
  while (Date.now() <= deadline) {
    const messages = await availableMessages(directory);
    if (
      messages.some(
        ({ message }) => message.purpose === options.purpose && message.to === options.to
      )
    ) {
      throw new Error("A fake email was unexpectedly delivered for this synthetic recipient.");
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
}
