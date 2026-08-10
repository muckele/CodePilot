export const SCRATCH_MAX_LENGTH = 20_000;

type ScratchStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const scratchPrefix = "codelift:scratch";

export function scratchStorageKey(userId: string, dayNumber: number): string {
  return `${scratchPrefix}:${userId}:${dayNumber}`;
}

export function readScratch(storage: ScratchStorage, userId: string, dayNumber: number): string {
  try {
    return (storage.getItem(scratchStorageKey(userId, dayNumber)) ?? "").slice(
      0,
      SCRATCH_MAX_LENGTH
    );
  } catch {
    return "";
  }
}

export function writeScratch(
  storage: ScratchStorage,
  userId: string,
  dayNumber: number,
  value: string
): void {
  try {
    storage.setItem(scratchStorageKey(userId, dayNumber), value.slice(0, SCRATCH_MAX_LENGTH));
  } catch {
    // Scratch notes are best-effort browser-local state, not saved evidence.
  }
}

export function clearUserScratchStorage(storage: ScratchStorage, userId: string): void {
  const accountPrefix = `${scratchPrefix}:${userId}:`;
  try {
    const matchingKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(accountPrefix) === true) matchingKeys.push(key);
    }
    for (const key of matchingKeys) storage.removeItem(key);
  } catch {
    // Server-side deletion still succeeds if browser storage is unavailable.
  }
}
