import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command, docker, repositoryRoot } from "../operations.mjs";
import { stateRoot } from "../state.mjs";

export async function withRestore(fault, check, beforeRestore = async () => {}) {
  const directory = mkdtempSync(join(tmpdir(), "codelift-restore-test-"));
  const backup = JSON.parse(command(process.execPath, ["infra/selfhost/cli.mjs", "backup"]));
  const proxy = join(repositoryRoot, "infra/selfhost/test-support/docker-proxy.mjs");
  const delay = join(directory, "delay.sh");
  writeFileSync(
    join(directory, "docker"),
    `#!/bin/sh\nexec '${process.execPath}' '${proxy}' "$@"\n`,
    { mode: 0o755 }
  );
  writeFileSync(
    delay,
    '#!/bin/bash\nsleep 8\nexec bash /opt/codelift/selfhost/mongo-entrypoint.sh "$@"\n',
    { mode: 0o755 }
  );
  try {
    await beforeRestore(backup);
    const result = spawnSync(
      process.execPath,
      ["infra/selfhost/cli.mjs", "restore", backup.filename],
      {
        encoding: "utf8",
        timeout: 180_000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          CODELIFT_TEST_DOCKER_FAULT: fault,
          CODELIFT_TEST_DELAY_SCRIPT: delay
        }
      }
    );
    await check(result, backup);
  } finally {
    const resources = JSON.parse(
      readFileSync(join(stateRoot, "evidence/restore-resources.json"), "utf8")
    );
    assert.match(resources.network, /^codelift-selfhost-restore-\d+-\d+$/);
    assert.equal(resources.container, `${resources.network}-mongo`);
    assert.equal(resources.volume, `${resources.network}-data`);
    for (const args of [
      ["rm", "-f", resources.container],
      ["volume", "rm", resources.volume],
      ["network", "rm", resources.network]
    ]) {
      try {
        docker(...args);
      } catch {
        /* Production cleanup may already have removed it. */
      }
    }
    for (const suffix of ["", ".json", ".sha256"])
      rmSync(join(stateRoot, "backups", `${backup.filename}${suffix}`), { force: true });
    rmSync(directory, { recursive: true, force: true });
  }
}
