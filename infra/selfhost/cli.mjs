import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { encryptBackup, pruneBackups, readBackupSnapshot, verifyBackup } from "./backup.mjs";
import {
  configureEmailState,
  disableEmailState,
  finalizeEmailKeyRotation,
  rollbackEmailKey,
  rotateEmailKey,
  rotateEmailPepper
} from "./email-state.mjs";
import {
  checkStack,
  command,
  compose,
  composeArgs,
  diskGate,
  docker,
  fixture,
  mongoImage,
  repositoryRoot,
  saveEvidence,
  validateOperationalEmailState
} from "./operations.mjs";
import { initializeState, stateRoot } from "./state.mjs";

function maintenance(action) {
  return compose(
    "exec",
    "-T",
    "-e",
    `MONGO_ACTION=${action}`,
    "mongodb",
    "mongosh",
    "--quiet",
    "--host",
    "127.0.0.1",
    "/opt/codelift/selfhost/mongo-maintenance.js"
  );
}

function exitStatus(child) {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Operational subprocess could not start.")));
    child.once("close", (status) =>
      status === 0
        ? resolve(0)
        : reject(new Error(`Operational subprocess failed (status ${status}); details suppressed.`))
    );
  });
}

export async function backup({ artifactRoot = stateRoot } = {}) {
  diskGate("backup", false, artifactRoot);
  const lock = join(stateRoot, "ops", "backup.lock");
  mkdirSync(lock, { mode: 0o700 });
  let locked = false;
  const started = Date.now();
  let dump;
  try {
    maintenance("lock");
    locked = true;
    const snapshot = JSON.parse(
      compose(
        "run",
        "--rm",
        "--no-deps",
        "-v",
        `${join(repositoryRoot, "infra/selfhost")}:/opt/codelift/selfhost:ro`,
        "seed",
        "node",
        "/opt/codelift/selfhost/snapshot.mjs"
      )
    );
    dump = spawn("docker", [...composeArgs, "run", "--rm", "--no-deps", "-T", "backup"], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 120_000
    });
    const done = exitStatus(dump);
    const sourceSha = command("git", ["rev-parse", "HEAD"]);
    const metadata = await encryptBackup({
      root: artifactRoot,
      recipientRoot: stateRoot,
      sourceSha,
      snapshot,
      input: dump.stdout,
      sourceCompletion: done
    });
    verifyBackup(artifactRoot, metadata.filename);
    pruneBackups(artifactRoot);
    return saveEvidence(
      "backup",
      {
        ...metadata,
        sourceDirty: command("git", ["status", "--porcelain"]) !== "",
        durationMs: Date.now() - started,
        retained: 8,
        offDevice: false
      },
      artifactRoot
    );
  } finally {
    if (dump && dump.exitCode === null) dump.kill("SIGTERM");
    if (locked) maintenance("unlock");
    rmSync(lock, { recursive: true, force: true });
    diskGate("backup-end", false, artifactRoot);
  }
}

async function up() {
  compose("up", "-d", "mongodb");
  compose("run", "--rm", "mongo-init");
  compose("up", "-d", "--wait", "--wait-timeout", "180", "api", "web");
}

function option(name, required = true) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith("--"))) {
    throw new Error(`--${name} is required.`);
  }
  return value;
}

function restartApi() {
  compose("up", "-d", "--wait", "--wait-timeout", "180", "api", "web");
}

export async function restore(
  filename,
  { artifactRoot = stateRoot, invocationId = randomUUID() } = {}
) {
  assert.match(invocationId, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  diskGate("restore-start", true, artifactRoot);
  const snapshot = readBackupSnapshot(artifactRoot, filename);
  const candidateBefore = fixture("fingerprint").fingerprint;
  const started = Date.now();
  const network = `codelift-selfhost-restore-${invocationId}`;
  const container = `${network}-mongo`;
  const volume = `${network}-data`;
  const scripts = join(repositoryRoot, "infra", "selfhost");
  const mount = (source, destination) => [
    "--mount",
    `type=bind,src=${source},dst=${destination},readonly`
  ];
  const secretMount = (name) => mount(join(stateRoot, "secrets", name), `/run/secrets/${name}`);
  let success = false;
  let createdContainer = false;
  let createdVolume = false;
  let createdNetwork = false;
  let stagingStarted = false;
  let verification = {};
  let verificationError;
  try {
    saveEvidence(
      "restore-resources",
      { invocationId, network, container, volume, hostPorts: [] },
      artifactRoot
    );
    docker(
      "network",
      "create",
      "--internal",
      "--label",
      `com.codelift.restore-invocation=${invocationId}`,
      network
    );
    createdNetwork = true;
    docker(
      "volume",
      "create",
      "--label",
      "com.codelift.purpose=isolated-restore",
      "--label",
      `com.codelift.restore-invocation=${invocationId}`,
      volume
    );
    createdVolume = true;
    docker(
      "run",
      "-d",
      "--name",
      container,
      "--label",
      `com.codelift.restore-invocation=${invocationId}`,
      "--network",
      network,
      "--network-alias",
      "mongodb",
      "--read-only",
      "--security-opt",
      "no-new-privileges:true",
      "--memory",
      "1536m",
      "--cpus",
      "1",
      "--stop-timeout",
      "60",
      "--log-opt",
      "max-size=5m",
      "--log-opt",
      "max-file=3",
      "--tmpfs",
      "/tmp:size=512m,mode=1777",
      "--tmpfs",
      "/data/configdb:size=16m,uid=999,gid=999,mode=0700",
      "--mount",
      `type=volume,src=${volume},dst=/data/db`,
      ...mount(scripts, "/opt/codelift/selfhost"),
      ...secretMount("mongo-admin-password"),
      ...secretMount("mongo-keyfile"),
      "-e",
      "MONGOSH_DISABLE_TELEMETRY=1",
      "--entrypoint",
      "bash",
      mongoImage,
      "/opt/codelift/selfhost/mongo-entrypoint.sh",
      "mongod",
      // Historical records must survive until fidelity is checked. Their TTL
      // indexes are restored and inspected; only this disposable drill opts out.
      "--setParameter",
      "ttlMonitorEnabled=false",
      "--replSet",
      "rs0",
      "--bind_ip_all",
      "--auth",
      "--keyFile",
      "/tmp/mongo-keyfile",
      "--wiredTigerCacheSizeGB",
      "0.5",
      "--oplogSize",
      "128"
    );
    createdContainer = true;
    // Use the same bounded remote-socket wait as normal authenticated startup.
    docker(
      "run",
      "--rm",
      "--network",
      network,
      "--read-only",
      "--tmpfs",
      "/tmp:size=64m,mode=1777",
      "--security-opt",
      "no-new-privileges:true",
      "--memory",
      "256m",
      "--cpus",
      "0.5",
      ...mount(scripts, "/opt/codelift/selfhost"),
      ...mount(
        join(repositoryRoot, "infra/mongo/init-replica.sh"),
        "/opt/codelift/init-replica.sh"
      ),
      ...secretMount("mongo-admin-password"),
      ...secretMount("mongo-app-password"),
      ...secretMount("mongo-backup-password"),
      "-e",
      "MONGO_HOST=mongodb",
      "-e",
      "MONGO_AUTH_ENABLED=true",
      "-e",
      "MONGO_REPLICA_SET=rs0",
      "-e",
      "MONGO_REPLICA_MEMBER=mongodb:27017",
      "-e",
      "MONGOSH_DISABLE_TELEMETRY=1",
      "--entrypoint",
      "bash",
      mongoImage,
      "/opt/codelift/init-replica.sh"
    );
    const encryption = spawn(
      "openssl",
      [
        "cms",
        "-decrypt",
        "-binary",
        "-inform",
        "DER",
        "-in",
        join(artifactRoot, "backups", filename),
        "-recip",
        join(stateRoot, "ops", "backup-recipient.pem"),
        "-inkey",
        join(stateRoot, "secrets", "backup-private-key.pem")
      ],
      { stdio: ["ignore", "pipe", "ignore"], timeout: 120_000 }
    );
    stagingStarted = true;
    const staging = spawn(
      "docker",
      ["exec", "-i", container, "sh", "-c", "umask 077; cat > /tmp/restore.archive.gz"],
      { stdio: ["pipe", "ignore", "ignore"], timeout: 120_000 }
    );
    try {
      await Promise.all([
        pipeline(encryption.stdout, staging.stdin),
        exitStatus(encryption),
        exitStatus(staging)
      ]);
    } finally {
      if (encryption.exitCode === null) encryption.kill();
      if (staging.exitCode === null) staging.kill();
    }
    docker(
      "exec",
      container,
      "mongosh",
      "--quiet",
      "--host",
      "127.0.0.1",
      "/opt/codelift/selfhost/mongo-restore-config.js"
    );
    diskGate("mongorestore", true, artifactRoot);
    docker(
      "exec",
      container,
      "mongorestore",
      "--host",
      "rs0/mongodb:27017",
      "--username",
      "codelift_admin",
      "--authenticationDatabase",
      "admin",
      "--config",
      "/tmp/restore-config.yml",
      "--archive=/tmp/restore.archive.gz",
      "--gzip",
      "--drop",
      "--nsInclude=codelift.*",
      "--numParallelCollections",
      "1",
      "--quiet"
    );
    // Check restored metadata before application startup can create indexes.
    const rawIndexes = JSON.parse(
      docker(
        "exec",
        container,
        "mongosh",
        "--quiet",
        "--host",
        "127.0.0.1",
        "/opt/codelift/selfhost/mongo-restore-verify.js"
      )
    );
    const identity = compose("config", "--format", "json");
    const api = JSON.parse(identity).services.api;
    const restored = JSON.parse(
      docker(
        "run",
        "--rm",
        "--network",
        network,
        "--read-only",
        "--user",
        api.user,
        "--memory",
        "512m",
        "--cpus",
        "1",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--tmpfs",
        "/tmp:size=32m,mode=1777",
        ...mount(scripts, "/opt/codelift/selfhost"),
        ...secretMount("mongo-uri"),
        ...Object.entries(api.environment).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
        api.image,
        "node",
        "/opt/codelift/selfhost/fixture.mjs",
        "verify"
      )
    );
    const candidateAfter = fixture("fingerprint").fingerprint;
    assert.equal(candidateAfter, candidateBefore, "restore left candidate data untouched");
    assert.equal(
      restored.fingerprint,
      snapshot.fingerprint,
      "restored application data matches the recorded backup-time snapshot"
    );
    assert.equal(restored.collections, snapshot.collections);
    const inspect = JSON.parse(docker("inspect", container))[0];
    assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
    assert.ok(inspect.Mounts.some((entry) => entry.Name === volume));
    success = true;
    verification = {
      ...rawIndexes,
      ...restored,
      candidateUntouched: true,
      hostPorts: []
    };
  } catch {
    verificationError = "Restore operation or verification failed; secret details suppressed.";
  }
  // Teardown steps must not short-circuit each other. Inspect actual final
  // state before recording any cleanup claim, even when a command failed.
  const errors = [];
  const attempt = (step, action) => {
    try {
      action();
      return true;
    } catch (error) {
      errors.push({ step, message: error.message });
      return false;
    }
  };
  let plaintextRemoved = false;
  let stopped = false;
  if (createdContainer) {
    plaintextRemoved = attempt("plaintext", () =>
      docker("exec", container, "rm", "-f", "/tmp/restore.archive.gz", "/tmp/restore-config.yml")
    );
    stopped = attempt("stop", () => docker("stop", container));
    if (success) attempt("container", () => docker("rm", "-f", container));
  }
  if (success && createdVolume) attempt("volume", () => docker("volume", "rm", volume));
  if (success && createdNetwork) attempt("network", () => docker("network", "rm", network));
  const resourceNames = { container, volume, network };
  const queries = {
    container: ["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.ID}}"],
    volume: ["volume", "ls", "--filter", `name=^${volume}$`, "--format", "{{.Name}}"],
    network: ["network", "ls", "--filter", `name=^${network}$`, "--format", "{{.Name}}"]
  };
  const resourceState = {};
  for (const [kind, args] of Object.entries(queries)) {
    resourceState[kind] = "unknown";
    attempt(`inspect-${kind}`, () => {
      resourceState[kind] = docker(...args) === "" ? "absent" : "present";
    });
  }
  const retainedResources = Object.entries(resourceState)
    .filter(([, state]) => state !== "absent")
    .map(([kind]) => resourceNames[kind]);
  attempt("disk", () => diskGate("restore-end", false, artifactRoot));
  const plaintextStaging = !stagingStarted
    ? "not created"
    : plaintextRemoved || resourceState.container === "absent"
      ? "removed"
      : stopped
        ? "unverified; isolated container stopped"
        : "unverified; inspect retained container";
  const passed = success && errors.length === 0 && retainedResources.length === 0;
  const evidence = saveEvidence(
    "restore",
    {
      status: passed ? "pass" : "failed",
      invocationId,
      filename,
      durationMs: Date.now() - started,
      verificationPassed: success,
      verificationError,
      ...verification,
      plaintextStaging,
      cleanup: {
        status: retainedResources.length === 0 ? "complete" : "incomplete",
        errors,
        retainedResources,
        resourceState
      }
    },
    artifactRoot
  );
  if (!passed)
    throw new Error("Restore did not complete cleanly; inspect the redacted restore evidence.");
  return evidence;
}

async function main() {
  const action = process.argv[2];
  if (action === "init") {
    initializeState();
    return { initialized: true };
  }
  if (!existsSync(join(stateRoot, "ops", "compose.env")))
    throw new Error("Operator state is not initialized.");
  if (action === "email-configure") {
    return configureEmailState({
      root: stateRoot,
      from: option("from"),
      replyTo: option("reply-to", false) ?? null,
      keyFile: option("key-file"),
      requestTimeoutMs: option("timeout-ms", false) ?? 5000
    });
  }
  if (action === "email-disable") return disableEmailState(stateRoot);
  if (action === "email-rotate-key") {
    const result = rotateEmailKey({ root: stateRoot, keyFile: option("key-file") });
    if (result.changed) restartApi();
    return result;
  }
  if (action === "email-finalize-key-rotation") {
    return finalizeEmailKeyRotation(stateRoot);
  }
  if (action === "email-rollback-key") {
    const result = rollbackEmailKey(stateRoot);
    restartApi();
    return result;
  }
  if (action === "email-rotate-pepper") {
    if (!process.argv.includes("--invalidate-active-codes")) {
      throw new Error("email-rotate-pepper requires --invalidate-active-codes.");
    }
    validateOperationalEmailState();
    const recovery = await backup();
    compose("stop", "api");
    try {
      const result = rotateEmailPepper({ root: stateRoot, invalidateActiveCodes: true });
      compose(
        "run",
        "--rm",
        "seed",
        "node",
        "apps/api/dist/account/operator-cli.js",
        "invalidate-email-login-codes"
      );
      restartApi();
      return { ...result, backup: recovery.filename };
    } catch (error) {
      restartApi();
      throw error;
    }
  }
  validateOperationalEmailState();
  if (action === "build") {
    const buildx = join(stateRoot, "ops", "buildx");
    mkdirSync(buildx, { recursive: true, mode: 0o700 });
    for (const service of ["api", "web"]) {
      diskGate(`build-${service}`, true);
      command("docker", [...composeArgs, "build", service], {
        stdio: "inherit",
        timeout: 30 * 60_000,
        env: { ...process.env, BUILDX_CONFIG: buildx }
      });
      diskGate(`build-${service}-end`);
    }
    return { built: ["api", "web"] };
  }
  if (action === "up") {
    await up();
    return { running: ["mongodb", "api", "web"] };
  }
  if (action === "seed") {
    compose("run", "--rm", "seed");
    compose("run", "--rm", "seed");
    return { seedRuns: 2, idempotent: true };
  }
  if (action === "fixture") return fixture("create");
  if (action === "check") return checkStack();
  if (action === "backup") return backup();
  if (action === "restore") return restore(process.argv[3]);
  if (action === "unlock") {
    maintenance("unlock");
    return { unlocked: true };
  }
  if (action === "persistence") {
    const initial = fixture("verify").persistenceFingerprint;
    const stages = [];
    for (const services of [["mongodb"], ["api", "web"]]) {
      compose("restart", ...services);
      compose("up", "-d", "--wait", "--wait-timeout", "180");
      assert.equal(
        fixture("verify").persistenceFingerprint,
        initial,
        `${services.join("/")} persisted user state`
      );
      stages.push(`${services.join("/")} restart`);
    }
    compose("down");
    await up();
    assert.equal(
      fixture("verify").persistenceFingerprint,
      initial,
      "compose down/up persisted user state"
    );
    stages.push("compose down/up without volume deletion");
    return saveEvidence("persistence", {
      status: "pass",
      stages,
      candidateVolume: "codelift_selfhost_mongo_data",
      dockerDesktopRestart: "deferred: unrelated active BigCapital containers"
    });
  }
  throw new Error(
    "Choose init, build, up, seed, fixture, check, backup, restore <filename>, persistence, unlock, email-configure, email-disable, email-rotate-key, email-finalize-key-rotation, email-rollback-key, or email-rotate-pepper."
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
