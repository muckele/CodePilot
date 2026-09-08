import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("operator initialization creates private, stable secrets and a working independent recipient", async () => {
  const module = await import("./state.mjs").catch(() => ({}));
  assert.equal(typeof module.initializeState, "function", "operator initializer is available");
  const parent = mkdtempSync(join(tmpdir(), "codelift-state-test-"));
  const root = join(parent, "state");
  try {
    module.initializeState(root);
    for (const directory of [
      root,
      ...["secrets", "backups", "ops", "evidence"].map((name) => join(root, name))
    ]) {
      assert.equal(statSync(directory).mode & 0o777, 0o700);
    }
    const secrets = readdirSync(join(root, "secrets"));
    const before = secrets.map((name) => {
      const path = join(root, "secrets", name);
      assert.equal(statSync(path).mode & 0o777, 0o600);
      return createHash("sha256").update(readFileSync(path)).digest("hex");
    });
    module.initializeState(root);
    assert.deepEqual(
      secrets.map((name) =>
        createHash("sha256")
          .update(readFileSync(join(root, "secrets", name)))
          .digest("hex")
      ),
      before
    );
    assert.match(
      readFileSync(join(root, "secrets", "mongo-keyfile"), "utf8"),
      /^[A-Za-z0-9+/]{1000,1024}\n?$/
    );
    const uri = new URL(readFileSync(join(root, "secrets", "mongo-uri"), "utf8").trim());
    assert.equal(uri.hostname, "mongodb");
    assert.equal(uri.searchParams.get("replicaSet"), "rs0");
    assert.equal(uri.searchParams.get("authSource"), "codelift");
    assert.ok(uri.password.length >= 43);
    assert.deepEqual(readdirSync(join(root, "backups")), []);
    const encrypted = spawnSync(
      "openssl",
      [
        "cms",
        "-encrypt",
        "-binary",
        "-aes-256-gcm",
        "-outform",
        "DER",
        join(root, "ops", "backup-recipient.pem")
      ],
      { input: "synthetic backup roundtrip" }
    );
    assert.equal(encrypted.status, 0);
    const decrypted = spawnSync(
      "openssl",
      [
        "cms",
        "-decrypt",
        "-binary",
        "-inform",
        "DER",
        "-inkey",
        join(root, "secrets", "backup-private-key.pem"),
        "-recip",
        join(root, "ops", "backup-recipient.pem")
      ],
      { input: encrypted.stdout }
    );
    assert.equal(decrypted.status, 0);
    assert.equal(decrypted.stdout.toString(), "synthetic backup roundtrip");
    writeFileSync(join(root, "secrets", "mongo-app-password"), "corrupt", { mode: 0o600 });
    assert.throws(() => module.initializeState(root), /invalid|incomplete/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
