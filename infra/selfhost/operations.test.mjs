import assert from "node:assert/strict";
import { test } from "node:test";

test("disk safety rejects new intensive work below 35 GiB and all operations near the 30 GiB floor", async () => {
  const module = await import("./operations.mjs").catch(() => ({}));
  assert.equal(typeof module.checkDiskBudget, "function", "disk gate is available");
  assert.throws(
    () => module.checkDiskBudget(34 * 1024 ** 3, true),
    /SELFHOST_DISK_PRESSURE_BLOCKED/
  );
  assert.throws(
    () => module.checkDiskBudget(30.5 * 1024 ** 3, false),
    /SELFHOST_DISK_PRESSURE_BLOCKED/
  );
  assert.doesNotThrow(() => module.checkDiskBudget(35 * 1024 ** 3, true));
  assert.doesNotThrow(() => module.checkDiskBudget(34 * 1024 ** 3, false));
});
