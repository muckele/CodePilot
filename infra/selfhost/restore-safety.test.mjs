import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { encryptBackup } from "./backup.mjs";
import { docker, mongoImage, repositoryRoot } from "./operations.mjs";
import { initializeState, stateRoot } from "./state.mjs";

for (const mode of ["success", "early-failure"]) {
  test(`restore test ${mode} preserves a full pre-existing backup set and stale retained diagnostics`, async () => {
    const root = mkdtempSync(join(tmpdir(), "codelift-safety-operator-"));
    const network = `codelift-selfhost-restore-1-${process.pid}${mode === "success" ? "1" : "2"}`;
    const container = `${network}-mongo`;
    const volume = `${network}-data`;
    const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
    try {
      initializeState(root);
      // Only non-secret Compose settings are copied; this test root has its
      // own generated credentials/recipient and never writes operator backups.
      copyFileSync(join(stateRoot, "ops/compose.env"), join(root, "ops/compose.env"));
      for (let day = 1; day <= 8; day++)
        await encryptBackup({
          root,
          sourceSha: "f".repeat(40),
          input: Readable.from([`synthetic retained recovery ${day}`]),
          date: new Date(`2026-01-0${day}T00:00:00Z`)
        });
      docker("network", "create", "--internal", network);
      docker("volume", "create", volume);
      docker(
        "create",
        "--name",
        container,
        "--network",
        network,
        "--mount",
        `type=volume,src=${volume},dst=/data/db`,
        "--entrypoint",
        "true",
        mongoImage
      );
      const stale = join(root, "evidence/restore-resources.json");
      writeFileSync(stale, JSON.stringify({ network, container, volume, hostPorts: [] }), {
        mode: 0o600
      });
      const originals = [
        ...readdirSync(join(root, "backups")).map((name) => join(root, "backups", name)),
        stale
      ];
      const before = originals.map((path) => ({ path, digest: hash(path) }));
      const source = `import assert from 'node:assert/strict'; import {withRestore} from './infra/selfhost/test-support/restore.mjs'; import {stateRoot} from './infra/selfhost/state.mjs'; assert.equal(stateRoot,process.env.CODELIFT_TEST_OPERATOR_ROOT); ${mode === "success" ? "await withRestore('none',r=>assert.equal(r.status,0,r.stderr));" : "await assert.rejects(withRestore('none',()=>{},()=>{throw new Error('synthetic early failure')}));"}`;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: repositoryRoot,
        encoding: "utf8",
        timeout: 180_000,
        env: {
          ...process.env,
          NODE_OPTIONS: `--import=${join(repositoryRoot, "infra/selfhost/test-support/operator-root-hook.mjs")}`,
          CODELIFT_TEST_OPERATOR_ROOT: root
        }
      });
      assert.equal(result.status, 0, result.stderr);
      const changed = before.filter(({ path, digest }) => {
        try {
          return hash(path) !== digest;
        } catch {
          return true;
        }
      });
      let diagnosticsPresent = true;
      for (const args of [
        ["inspect", container],
        ["volume", "inspect", volume],
        ["network", "inspect", network]
      ]) {
        try {
          docker(...args);
        } catch {
          diagnosticsPresent = false;
        }
      }
      assert.deepEqual(
        { changedArtifacts: changed.length, diagnosticsPresent },
        { changedArtifacts: 0, diagnosticsPresent: true },
        "pre-existing archives/evidence and retained diagnostics are preserved"
      );
      assert.equal(docker("inspect", container, "--format", "{{.Name}}"), `/${container}`);
      assert.equal(docker("volume", "inspect", volume, "--format", "{{.Name}}"), volume);
      assert.equal(docker("network", "inspect", network, "--format", "{{.Name}}"), network);
    } finally {
      for (const args of [
        ["rm", "-f", container],
        ["volume", "rm", volume],
        ["network", "rm", network]
      ]) {
        try {
          docker(...args);
        } catch {
          /* The RED may have wrongly removed this test sentinel. */
        }
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
}
