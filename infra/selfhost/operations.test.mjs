import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("operational email-state validation fails before a Compose command can run", async () => {
  const { initializeState } = await import("./state.mjs");
  const module = await import("./operations.mjs");
  assert.equal(typeof module.validateOperationalEmailState, "function");
  const parent = mkdtempSync(join(tmpdir(), "codelift-email-operation-test-"));
  const root = join(parent, "state");
  try {
    initializeState(root);
    assert.equal(module.validateOperationalEmailState(root).provider, "disabled");
    const environmentPath = join(root, "ops", "compose.env");
    writeFileSync(
      environmentPath,
      readFileSync(environmentPath, "utf8").replace(
        "EMAIL_PROVIDER=disabled",
        "EMAIL_PROVIDER=fake"
      ),
      { mode: 0o600 }
    );
    assert.throws(() => module.validateOperationalEmailState(root), /fake|production/u);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
