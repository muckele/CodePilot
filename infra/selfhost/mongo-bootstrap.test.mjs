import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { diskGate, docker, mongoImage, repositoryRoot } from "./operations.mjs";

test("fresh Mongo root bootstrap never passes a mounted synthetic credential in child arguments", async () => {
  diskGate("test-bootstrap-start", true);
  const directory = mkdtempSync(join(tmpdir(), "codelift-bootstrap-"));
  const container = `codelift-bootstrap-test-${process.pid}`;
  const volume = `${container}-data`;
  const bind = (source, target) => ["--mount", `type=bind,src=${source},dst=${target}`];
  mkdirSync(join(directory, "bin"));
  writeFileSync(join(directory, "password"), randomBytes(48).toString("base64url"), {
    mode: 0o644
  });
  writeFileSync(join(directory, "key"), randomBytes(756).toString("base64"), { mode: 0o644 });
  writeFileSync(join(directory, "events"), "", { mode: 0o666 });
  chmodSync(join(directory, "events"), 0o666);
  chmodSync(directory, 0o755);
  for (const [name, path] of Object.entries({
    jq: "/usr/bin/jq",
    mongosh: "/usr/bin/mongosh",
    mongod: "/usr/bin/mongod",
    gosu: "/usr/local/bin/gosu"
  })) {
    writeFileSync(
      join(directory, "bin", name),
      `#!/bin/bash\nfor argument; do\n  if [[ "$argument" == *"$(</run/secrets/mongo-admin-password)"* ]]; then printf 'secret-in-argv\\n' >> /probe/events; fi\ndone\nprintf '${name}\\n' >> /probe/events\nexec ${path} "$@"\n`,
      { mode: 0o755 }
    );
  }
  try {
    docker("volume", "create", volume);
    docker(
      "run",
      "-d",
      "--name",
      container,
      "--network",
      "none",
      "--memory",
      "1536m",
      "--cpus",
      "1",
      "--read-only",
      "--tmpfs",
      "/tmp:size=64m,mode=1777",
      "--tmpfs",
      "/data/configdb:size=16m,uid=999,gid=999",
      "--mount",
      `type=volume,src=${volume},dst=/data/db`,
      ...bind(directory, "/probe"),
      ...bind(join(directory, "password"), "/run/secrets/mongo-admin-password"),
      ...bind(join(directory, "key"), "/run/secrets/mongo-keyfile"),
      ...bind(join(repositoryRoot, "infra", "selfhost"), "/opt/codelift/selfhost"),
      "-e",
      "PATH=/probe/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
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
      "0.5"
    );
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(
          "exec",
          container,
          "mongosh",
          "--quiet",
          "--host",
          "127.0.0.1",
          "--eval",
          "const a=db.getSiblingDB('admin'); if(!a.auth('codelift_admin',require('fs').readFileSync('/run/secrets/mongo-admin-password','utf8').trim())) quit(1); const o=a.runCommand({getCmdLineOpts:1}); quit((o.parsed.replication?.replSetName??o.parsed.replication?.replSet)==='rs0'?0:1)"
        );
        ready = true;
        break;
      } catch {
        await setTimeout(500);
      }
    }
    assert.equal(ready, true, "fresh authenticated final Mongo process became reachable");
    const events = readFileSync(join(directory, "events"), "utf8");
    assert.ok(events.includes("mongosh"), "actual database-client child arguments were inspected");
    assert.equal(
      events.includes("secret-in-argv"),
      false,
      "no child received a credential argument"
    );
  } finally {
    try {
      docker("rm", "-f", container);
    } catch {
      /* May not have started. */
    }
    docker("volume", "rm", volume);
    rmSync(directory, { recursive: true, force: true });
    diskGate("test-bootstrap-end");
  }
});
