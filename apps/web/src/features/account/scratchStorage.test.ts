import { beforeEach, describe, expect, it } from "vitest";

import {
  clearUserScratchStorage,
  readScratch,
  scratchStorageKey,
  writeScratch
} from "./scratchStorage";

describe("account-scoped scratch storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("does not expose legacy or another account's day notes", () => {
    window.localStorage.setItem("codelift:scratch:1", "legacy unscoped note");
    writeScratch(window.localStorage, "64f000000000000000000001", 1, "owner note");

    expect(readScratch(window.localStorage, "64f000000000000000000001", 1)).toBe("owner note");
    expect(readScratch(window.localStorage, "64f000000000000000000002", 1)).toBe("");
  });

  it("removes only the deleted account's browser-local notes", () => {
    writeScratch(window.localStorage, "64f000000000000000000001", 1, "owner day one");
    writeScratch(window.localStorage, "64f000000000000000000001", 2, "owner day two");
    writeScratch(window.localStorage, "64f000000000000000000002", 1, "other account");

    clearUserScratchStorage(window.localStorage, "64f000000000000000000001");

    expect(
      window.localStorage.getItem(scratchStorageKey("64f000000000000000000001", 1))
    ).toBeNull();
    expect(
      window.localStorage.getItem(scratchStorageKey("64f000000000000000000001", 2))
    ).toBeNull();
    expect(readScratch(window.localStorage, "64f000000000000000000002", 1)).toBe("other account");
  });
});
