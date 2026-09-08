// Fault injection below the real CLI: all non-injected calls use real Docker.
import { spawnSync } from "node:child_process";
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
process.exit(result.status ?? 1);
