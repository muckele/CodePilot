import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command, docker, repositoryRoot } from "../operations.mjs";

export async function withRestore(fault, check, beforeRestore = async () => {}) {
  const directory = mkdtempSync(join(tmpdir(), "codelift-restore-test-"));
  const artifactRoot = join(directory, "artifacts");
  mkdirSync(join(artifactRoot, "backups"), { recursive: true, mode: 0o700 });
  mkdirSync(join(artifactRoot, "evidence"), { mode: 0o700 });
  const invocationId = randomUUID();
  const network = `codelift-selfhost-restore-${invocationId}`;
  const resources = { network, container: `${network}-mongo`, volume: `${network}-data` };
  const context = { artifactRoot, invocationId, resources };
  const cli = new URL("../cli.mjs", import.meta.url).href;
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
    const backup = JSON.parse(
      command(process.execPath, [
        "--input-type=module",
        "-e",
        `const {backup}=await import(${JSON.stringify(cli)}); console.log(JSON.stringify(await backup({artifactRoot:${JSON.stringify(artifactRoot)}})));`
      ])
    );
    await beforeRestore(backup, context);
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {restore}=await import(${JSON.stringify(cli)}); try { console.log(JSON.stringify(await restore(${JSON.stringify(backup.filename)},${JSON.stringify({ artifactRoot, invocationId })}))); } catch(error) { console.error(error.message); process.exitCode=1; }`
      ],
      {
        encoding: "utf8",
        timeout: 180_000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          CODELIFT_TEST_DOCKER_FAULT: fault,
          CODELIFT_TEST_DELAY_SCRIPT: delay,
          CODELIFT_TEST_OBSERVATION: join(artifactRoot, "ttl-observation.json")
        }
      }
    );
    await check(result, backup, context);
  } finally {
    // Never read shared/stale evidence. Only this invocation's derived names
    // and matching Docker ownership labels authorize fallback test cleanup.
    for (const [kind, name, args] of [
      ["container", resources.container, ["rm", "-f", resources.container]],
      ["volume", resources.volume, ["volume", "rm", resources.volume]],
      ["network", resources.network, ["network", "rm", resources.network]]
    ]) {
      let entry;
      try {
        entry = JSON.parse(
          docker(...(kind === "container" ? ["inspect", name] : [kind, "inspect", name]))
        )[0];
      } catch {
        /* Production cleanup may already have removed it. */
        continue;
      }
      const labels = kind === "container" ? entry.Config.Labels : entry.Labels;
      assert.equal(
        labels["com.codelift.restore-invocation"],
        invocationId,
        "cleanup requires this invocation's ownership label"
      );
      docker(...args);
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
