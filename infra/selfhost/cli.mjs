import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { encryptBackup, pruneBackups, verifyBackup } from "./backup.mjs";
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
  saveEvidence
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

async function backup() {
  diskGate("backup");
  const lock = join(stateRoot, "ops", "backup.lock");
  mkdirSync(lock, { mode: 0o700 });
  let locked = false;
  const started = Date.now();
  let dump;
  try {
    maintenance("lock");
    locked = true;
    dump = spawn("docker", [...composeArgs, "run", "--rm", "--no-deps", "-T", "backup"], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 120_000
    });
    const done = exitStatus(dump);
    const sourceSha = command("git", ["rev-parse", "HEAD"]);
    const metadata = await encryptBackup({
      root: stateRoot,
      sourceSha,
      input: dump.stdout,
      sourceCompletion: done
    });
    verifyBackup(stateRoot, metadata.filename);
    pruneBackups(stateRoot);
    return saveEvidence("backup", {
      ...metadata,
      sourceDirty: command("git", ["status", "--porcelain"]) !== "",
      durationMs: Date.now() - started,
      retained: 8,
      offDevice: false
    });
  } finally {
    if (dump && dump.exitCode === null) dump.kill("SIGTERM");
    if (locked) maintenance("unlock");
    rmSync(lock, { recursive: true, force: true });
    diskGate("backup-end");
  }
}

async function up() {
  compose("up", "-d", "mongodb");
  compose("run", "--rm", "mongo-init");
  compose("up", "-d", "--wait", "--wait-timeout", "180", "api", "web");
}

async function restore(filename) {
  diskGate("restore-start", true);
  verifyBackup(stateRoot, filename);
  const candidateBefore = fixture("fingerprint").fingerprint;
  const started = Date.now();
  const suffix = `${Date.now()}-${process.pid}`;
  const network = `codelift-selfhost-restore-${suffix}`;
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
  try {
    docker("network", "create", "--internal", network);
    createdNetwork = true;
    docker("volume", "create", "--label", "com.codelift.purpose=isolated-restore", volume);
    createdVolume = true;
    docker(
      "run",
      "-d",
      "--name",
      container,
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
      "MONGO_INITDB_ROOT_USERNAME=codelift_admin",
      "-e",
      "MONGO_INITDB_ROOT_PASSWORD_FILE=/run/secrets/mongo-admin-password",
      "-e",
      "MONGOSH_DISABLE_TELEMETRY=1",
      "--entrypoint",
      "bash",
      mongoImage,
      "/opt/codelift/selfhost/mongo-entrypoint.sh",
      "mongod",
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
    saveEvidence("restore-resources", { network, container, volume, hostPorts: [] });
    // The official entrypoint briefly starts a localhost-only bootstrap mongod.
    // Retry the helper until the private authenticated process accepts sockets.
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(
          "exec",
          container,
          "mongosh",
          "--quiet",
          "--host",
          "127.0.0.1",
          "/opt/codelift/selfhost/mongo-health.js"
        );
        break;
      } catch {
        if (attempt >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
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
      ...secretMount("mongo-admin-password"),
      ...secretMount("mongo-app-password"),
      ...secretMount("mongo-backup-password"),
      "-e",
      "MONGO_HOST=mongodb",
      "-e",
      "MONGO_REPLICA_SET=rs0",
      "-e",
      "MONGO_REPLICA_MEMBER=mongodb:27017",
      "-e",
      "MONGOSH_DISABLE_TELEMETRY=1",
      "--entrypoint",
      "mongosh",
      mongoImage,
      "--quiet",
      "--host",
      "mongodb",
      "/opt/codelift/selfhost/mongo-init.js"
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
        join(stateRoot, "backups", filename),
        "-recip",
        join(stateRoot, "ops", "backup-recipient.pem"),
        "-inkey",
        join(stateRoot, "secrets", "backup-private-key.pem")
      ],
      { stdio: ["ignore", "pipe", "ignore"], timeout: 120_000 }
    );
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
    diskGate("mongorestore", true);
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
      candidateBefore,
      "restored application data matches the source snapshot"
    );
    const inspect = JSON.parse(docker("inspect", container))[0];
    assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
    assert.ok(inspect.Mounts.some((entry) => entry.Name === volume));
    success = true;
    return saveEvidence("restore", {
      status: "pass",
      durationMs: Date.now() - started,
      filename,
      ...rawIndexes,
      ...restored,
      candidateUntouched: true,
      hostPorts: [],
      plaintextStaging: "container tmpfs only; removed",
      cleanup: "isolated container, volume and network removed"
    });
  } finally {
    if (createdContainer) {
      docker("exec", container, "rm", "-f", "/tmp/restore.archive.gz", "/tmp/restore-config.yml");
      if (success) docker("rm", "-f", container);
      else docker("stop", container);
    }
    if (success && createdVolume) docker("volume", "rm", volume);
    if (success && createdNetwork) docker("network", "rm", network);
    diskGate("restore-end");
  }
}

async function main() {
  const action = process.argv[2];
  if (action === "init") {
    initializeState();
    return { initialized: true };
  }
  if (!existsSync(join(stateRoot, "ops", "compose.env")))
    throw new Error("Operator state is not initialized.");
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
    "Choose init, build, up, seed, fixture, check, backup, restore <filename>, persistence, or unlock."
  );
}

try {
  const result = await main();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
