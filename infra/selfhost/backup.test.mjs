import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { initializeState } from "./state.mjs";

test("backup streaming retains only recipient-encrypted bytes with a validated hash and bounded retention", async () => {
  const module = await import("./backup.mjs").catch(() => ({}));
  assert.equal(typeof module.encryptBackup, "function", "backup encryption pipeline is available");
  const root = mkdtempSync(join(tmpdir(), "codelift-backup-test-"));
  try {
    initializeState(root);
    const first = await module.encryptBackup({
      root,
      sourceSha: "a".repeat(40),
      input: Readable.from(["synthetic private fixture"]),
      date: new Date("2026-09-01T00:00:00Z")
    });
    assert.ok(module.verifyBackup(root, first.filename));
    const encrypted = readFileSync(join(root, "backups", first.filename));
    assert.ok(!encrypted.includes(Buffer.from("synthetic private fixture")));
    const decrypted = spawnSync(
      "openssl",
      [
        "cms",
        "-decrypt",
        "-binary",
        "-inform",
        "DER",
        "-recip",
        join(root, "ops", "backup-recipient.pem"),
        "-inkey",
        join(root, "secrets", "backup-private-key.pem")
      ],
      { input: encrypted }
    );
    assert.equal(decrypted.status, 0);
    assert.equal(decrypted.stdout.toString(), "synthetic private fixture");
    assert.ok(!JSON.stringify(first).includes("synthetic private fixture"));
    encrypted[encrypted.length - 1] ^= 1;
    writeFileSync(join(root, "backups", first.filename), encrypted);
    assert.throws(() => module.verifyBackup(root, first.filename), /integrity/i);
    assert.throws(() => module.verifyBackup(root, "../../secrets/mongo-uri"), /filename/i);
    await assert.rejects(
      module.encryptBackup({ root, sourceSha: "unsafe", input: Readable.from(["fixture"]) }),
      /revision/i
    );
    for (let day = 2; day <= 4; day++)
      await module.encryptBackup({
        root,
        sourceSha: "b".repeat(40),
        input: Readable.from(["fixture"]),
        date: new Date(`2026-09-0${day}T00:00:00Z`)
      });
    module.pruneBackups(root, 2);
    const retained = readdirSync(join(root, "backups"));
    assert.equal(retained.length, 6);
    assert.ok(retained.every((name) => /2026090[34]T/.test(name)));
    assert.ok(retained.every((name) => /\.cms(?:\.sha256|\.json)?$/.test(name)));
    const existingName = retained.find(
      (name) => name.endsWith(".cms") && name.includes("20260904")
    );
    const existingBytes = readFileSync(join(root, "backups", existingName));
    await assert.rejects(
      module.encryptBackup({
        root,
        sourceSha: "b".repeat(40),
        input: Readable.from(["duplicate timestamp"]),
        date: new Date("2026-09-04T00:00:00Z")
      })
    );
    assert.ok(
      existsSync(join(root, "backups", existingName)),
      "a duplicate name must preserve the retained backup"
    );
    assert.deepEqual(
      readFileSync(join(root, "backups", existingName)),
      existingBytes,
      "a duplicate backup name cannot overwrite or delete the retained artifact"
    );
    const failed = Readable.from(
      (async function* () {
        yield "partial fixture";
        throw new Error("synthetic stream failure");
      })()
    );
    await assert.rejects(module.encryptBackup({ root, sourceSha: "c".repeat(40), input: failed }));
    assert.deepEqual(readdirSync(join(root, "backups")), retained);
    await assert.rejects(
      module.encryptBackup({
        root,
        sourceSha: "d".repeat(40),
        input: Readable.from(["incomplete dump"]),
        sourceCompletion: Promise.resolve(1)
      })
    );
    assert.deepEqual(readdirSync(join(root, "backups")), retained);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
