// Fault injection below the real CLI: all non-injected calls use real Docker.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
const args = process.argv.slice(2);
const mode = process.env.CODELIFT_TEST_DOCKER_FAULT;
const isRestore = args.some((arg) => arg.startsWith("codelift-selfhost-restore-"));
if (mode === "delayed-bootstrap" && args[0] === "run" && args.includes("--name") && isRestore) {
  const script = args.indexOf("/opt/codelift/selfhost/mongo-entrypoint.sh");
  args[script] = "/test-delay-entrypoint.sh";
  args.splice(
    args.indexOf("--entrypoint"),
    0,
    "--mount",
    `type=bind,src=${process.env.CODELIFT_TEST_DELAY_SCRIPT},dst=/test-delay-entrypoint.sh,readonly`
  );
}
if (
  mode?.startsWith("cleanup-failure") &&
  isRestore &&
  ((args[0] === "exec" && args.includes("/tmp/restore.archive.gz") && args.includes("rm")) ||
    (mode === "cleanup-failure-retained" && args[0] === "rm"))
)
  process.exit(42);
const result = spawnSync("/usr/local/bin/docker", args, { stdio: "inherit" });
if (
  mode === "ttl-interval" &&
  isRestore &&
  args[0] === "exec" &&
  args.includes("mongorestore") &&
  result.status === 0
) {
  // Cross the default 60-second TTL interval after indexes/data are restored.
  await setTimeout(65_000);
  const probe = spawnSync(
    "/usr/local/bin/docker",
    [
      "exec",
      args[1],
      "mongosh",
      "--quiet",
      "--host",
      "127.0.0.1",
      "--eval",
      "const a=db.getSiblingDB('admin'); if(!a.auth('codelift_admin',require('fs').readFileSync('/run/secrets/mongo-admin-password','utf8').trim())) quit(1); const c=db.getSiblingDB('codelift').getCollection('sessions'); print(JSON.stringify({recordCount:c.countDocuments({tokenHash:'selfhost-ttl-expiry-regression'}),ttlIndex:c.getIndexes().some(i=>i.key.expiresAt===1&&i.expireAfterSeconds===0),ttlMonitorEnabled:a.runCommand({getParameter:1,ttlMonitorEnabled:1}).ttlMonitorEnabled}));"
    ],
    { encoding: "utf8" }
  );
  writeFileSync(
    process.env.CODELIFT_TEST_OBSERVATION,
    JSON.stringify(probe.status === 0 ? JSON.parse(probe.stdout) : { probeFailed: true }),
    { mode: 0o600 }
  );
}
process.exit(result.status ?? 1);
