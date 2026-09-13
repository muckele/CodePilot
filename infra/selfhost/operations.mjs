import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, statfsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stateRoot } from "./state.mjs";
import { validateEmailState } from "./email-state.mjs";

export const repositoryRoot = resolve(import.meta.dirname, "../..");
export const composeArgs = [
  "compose",
  "--env-file",
  join(stateRoot, "ops", "compose.env"),
  "-f",
  "infra/compose.selfhost.yaml"
];
export const mongoImage =
  "mongo:8.0.26@sha256:3ce3de7f40e914034b03b7dec654005ab54f7dc8306937e44ec6760d9e9409a1";

export function validateOperationalEmailState(root = stateRoot) {
  return validateEmailState(root);
}

export function checkDiskBudget(availableBytes, intensive) {
  if (availableBytes < (intensive ? 35 : 31) * 1024 ** 3)
    throw new Error("SELFHOST_DISK_PRESSURE_BLOCKED");
}

export function diskGate(operation, intensive = false, evidenceRoot = stateRoot) {
  const space = statfsSync(repositoryRoot);
  const availableBytes = space.bavail * space.bsize;
  appendFileSync(
    join(evidenceRoot, "evidence", "disk.jsonl"),
    `${JSON.stringify({ time: new Date().toISOString(), operation, availableBytes })}\n`,
    { mode: 0o600 }
  );
  checkDiskBudget(availableBytes, intensive);
  return availableBytes;
}

export function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0)
    throw new Error(
      `${binary} operation failed (status ${result.status}); details suppressed to protect runtime secrets.`
    );
  return result.stdout?.trim() ?? "";
}
export const docker = (...args) => command("docker", args);
export const compose = (...args) => docker(...composeArgs, ...args);

export function saveEvidence(name, data, evidenceRoot = stateRoot) {
  if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid evidence name.");
  writeFileSync(
    join(evidenceRoot, "evidence", `${name}.json`),
    `${JSON.stringify(data, null, 2)}\n`,
    {
      mode: 0o600
    }
  );
  return data;
}

export function fixture(action = "verify") {
  return JSON.parse(
    compose(
      "run",
      "--rm",
      "--no-deps",
      "-v",
      `${join(repositoryRoot, "infra", "selfhost")}:/opt/codelift/selfhost:ro`,
      "seed",
      "node",
      "/opt/codelift/selfhost/fixture.mjs",
      action
    )
  );
}

export function scanSecretLeaks(additional = []) {
  const files = command("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean);
  const needles = readdirSync(join(stateRoot, "secrets"))
    .map((name) => readFileSync(join(stateRoot, "secrets", name), "utf8").trim())
    .filter((value) => value.length >= 16);
  const leaked = [
    ...files.map((path) => readFileSync(join(repositoryRoot, path))),
    ...additional.map((value) => Buffer.from(value))
  ].some((content) => needles.some((secret) => content.includes(Buffer.from(secret))));
  if (leaked) throw new Error("Runtime secret leak detected; values suppressed.");
  return 0;
}

export async function checkStack() {
  validateOperationalEmailState();
  diskGate("check");
  const ids = compose("ps", "-q").split("\n").filter(Boolean);
  const raw = docker("inspect", ...ids);
  const containers = JSON.parse(raw);
  assert.deepEqual(
    containers.map((entry) => entry.Config.Labels["com.docker.compose.service"]).sort(),
    ["api", "mongodb", "web"]
  );
  const services = containers.map((entry) => {
    const service = entry.Config.Labels["com.docker.compose.service"];
    const ports = Object.values(entry.HostConfig.PortBindings ?? {}).flat();
    if (service === "web") assert.deepEqual(ports, [{ HostIp: "127.0.0.1", HostPort: "8080" }]);
    else assert.equal(ports.length, 0);
    assert.equal(entry.State.Health.Status, "healthy");
    assert.equal(entry.HostConfig.RestartPolicy.Name, "always");
    assert.equal(entry.HostConfig.ReadonlyRootfs, true);
    assert.ok(entry.HostConfig.SecurityOpt.includes("no-new-privileges:true"));
    assert.equal(entry.HostConfig.LogConfig.Config["max-size"], "5m");
    assert.equal(entry.HostConfig.LogConfig.Config["max-file"], "3");
    assert.ok(entry.HostConfig.Memory <= 1536 * 1024 ** 2);
    assert.ok(entry.HostConfig.NanoCpus <= 1e9);
    assert.ok(
      !entry.Mounts.some((mount) =>
        /docker\.sock|\/Documents$|\/Desktop|\/Downloads|\/Photos|\/\.ssh/.test(mount.Source)
      )
    );
    if (service === "mongodb")
      assert.ok(
        entry.Mounts.some(
          (mount) =>
            mount.Name === "codelift_selfhost_mongo_data" && mount.Destination === "/data/db"
        )
      );
    if (service === "api")
      assert.ok(
        entry.Config.Env.includes("MONGO_URI_FILE=/run/secrets/mongo-uri") &&
          !entry.Config.Env.some((value) => value.startsWith("MONGO_URI="))
      );
    return {
      service,
      health: entry.State.Health.Status,
      ports,
      memoryLimit: entry.HostConfig.Memory,
      nanoCpus: entry.HostConfig.NanoCpus,
      restart: entry.HostConfig.RestartPolicy.Name
    };
  });
  for (const path of ["/healthz", "/health", "/ready"]) {
    const response = await fetch(`http://127.0.0.1:8080${path}`);
    assert.equal(response.status, 200, path);
  }
  const auth = JSON.parse(
    compose(
      "run",
      "--rm",
      "--no-deps",
      "--entrypoint",
      "mongosh",
      "mongo-init",
      "--quiet",
      "--host",
      "mongodb",
      "/opt/codelift/selfhost/mongo-check.js"
    )
  );
  const data = fixture("verify");
  const logs = compose("logs", "--no-color", "--tail", "500");
  const secretLeaks = scanSecretLeaks([raw, logs]);
  const stats = docker("stats", "--no-stream", "--format", "{{json .}}", ...ids)
    .split("\n")
    .map((row) => {
      const item = JSON.parse(row);
      return {
        service: item.Name.replace("codelift-selfhost-", "").replace(/-1$/, ""),
        memory: item.MemUsage,
        cpu: item.CPUPerc
      };
    });
  return saveEvidence("stack", {
    status: "pass",
    services,
    ...auth,
    fixture: data,
    secretLeaks,
    stats
  });
}
