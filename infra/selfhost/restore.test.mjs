import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { withRestore } from "./test-support/restore.mjs";
import { compose, docker, fixture } from "./operations.mjs";

test("restore waits for a delayed fresh Mongo socket before authenticated initialization", async () => {
  await withRestore("delayed-bootstrap", (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "pass");
  });
});

test("historical restore preserves an archived session across a TTL interval after its expiry", async () => {
  const expires = Date.now() + 8000;
  const mutate = (insert) =>
    compose(
      "exec",
      "-T",
      "api",
      "node",
      "--input-type=module",
      "-e",
      `const {loadApiConfig}=await import('/app/apps/api/dist/config.js'); const {default:m}=await import('/app/apps/api/node_modules/mongoose/index.js'); const c=new m.mongo.MongoClient(loadApiConfig().persistence.mongoUri); await c.connect(); try { const sessions=c.db('codelift').collection('sessions'); ${insert ? `await sessions.insertOne({tokenHash:'selfhost-ttl-expiry-regression',csrfHash:'synthetic-unusable',userId:null,issuedAt:new Date(),lastSeenAt:new Date(),idleExpiresAt:new Date(${expires}),absoluteExpiresAt:new Date(${expires}),expiresAt:new Date(${expires}),schemaVersion:1});` : "await sessions.deleteOne({tokenHash:'selfhost-ttl-expiry-regression'});"} } finally { await c.close(); }`
    );
  const candidateTtl = () =>
    compose(
      "exec",
      "-T",
      "mongodb",
      "mongosh",
      "--quiet",
      "--host",
      "127.0.0.1",
      "--eval",
      "const a=db.getSiblingDB('admin'); a.auth('codelift_admin',require('fs').readFileSync('/run/secrets/mongo-admin-password','utf8').trim()); print(a.runCommand({getParameter:1,ttlMonitorEnabled:1}).ttlMonitorEnabled);"
    );
  assert.equal(candidateTtl(), "true");
  try {
    mutate(true);
    await withRestore(
      "ttl-interval",
      (result, backup, { artifactRoot }) => {
        const observation = JSON.parse(
          readFileSync(join(artifactRoot, "ttl-observation.json"), "utf8")
        );
        assert.equal(
          observation.recordCount,
          1,
          "expired-at-restore-time record survives the real TTL interval"
        );
        assert.equal(observation.ttlIndex, true, "the restored TTL index is retained");
        assert.equal(
          observation.ttlMonitorEnabled,
          false,
          "only the drill's TTL deletion is disabled"
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(result.stdout).fingerprint, backup.snapshot.fingerprint);
      },
      async () => {
        await setTimeout(Math.max(0, expires + 100 - Date.now()));
        // Keep the candidate unchanged during the isolated interval; its normal
        // TTL behavior must not be disabled for the verification fixture.
        mutate(false);
      }
    );
  } finally {
    mutate(false);
  }
  assert.equal(candidateTtl(), "true");
});

test("a staging-cleanup failure still tears down other restore resources and cannot record pass", async () => {
  await withRestore("cleanup-failure", (result, backup, { artifactRoot }) => {
    assert.notEqual(result.status, 0);
    const evidence = JSON.parse(readFileSync(join(artifactRoot, "evidence/restore.json"), "utf8"));
    const resources = JSON.parse(
      readFileSync(join(artifactRoot, "evidence/restore-resources.json"), "utf8")
    );
    assert.equal(evidence.filename, backup.filename);
    assert.equal(evidence.status, "failed");
    assert.deepEqual(evidence.cleanup.retainedResources, []);
    assert.equal(evidence.plaintextStaging, "removed");
    assert.ok(evidence.cleanup.errors.some((entry) => entry.step === "plaintext"));
    assert.equal(
      docker("ps", "-a", "--filter", `name=^/${resources.container}$`, "--format", "{{.ID}}"),
      ""
    );
    assert.equal(
      docker("volume", "ls", "--filter", `name=^${resources.volume}$`, "--format", "{{.Name}}"),
      ""
    );
    assert.equal(
      docker("network", "ls", "--filter", `name=^${resources.network}$`, "--format", "{{.Name}}"),
      ""
    );
  });
});

test("failed container cleanup records exact retained resources and still stops the isolated Mongo", async () => {
  await withRestore("cleanup-failure-retained", (result, backup, { artifactRoot }) => {
    assert.notEqual(result.status, 0);
    const evidence = JSON.parse(readFileSync(join(artifactRoot, "evidence/restore.json"), "utf8"));
    const resources = JSON.parse(
      readFileSync(join(artifactRoot, "evidence/restore-resources.json"), "utf8")
    );
    assert.equal(evidence.status, "failed");
    assert.deepEqual(
      evidence.cleanup.retainedResources.sort(),
      [resources.container, resources.volume].sort()
    );
    assert.equal(docker("inspect", resources.container, "--format", "{{.State.Running}}"), "false");
    assert.equal(evidence.plaintextStaging, "unverified; isolated container stopped");
    assert.ok(evidence.cleanup.errors.some((entry) => entry.step === "container"));
    assert.ok(evidence.cleanup.errors.some((entry) => entry.step === "volume"));
    assert.equal(evidence.cleanup.resourceState.network, "absent");
    assert.equal(
      docker("network", "ls", "--filter", `name=^${resources.network}$`, "--format", "{{.Name}}"),
      ""
    );
  });
});

test("a retained backup restores its historical snapshot after later candidate writes", async () => {
  const original = fixture("fingerprint").fingerprint;
  const mutate = (insert) =>
    compose(
      "exec",
      "-T",
      "api",
      "node",
      "--input-type=module",
      "-e",
      `const {loadApiConfig}=await import('/app/apps/api/dist/config.js'); const {default:m}=await import('/app/apps/api/node_modules/mongoose/index.js'); const c=new m.mongo.MongoClient(loadApiConfig().persistence.mongoUri); await c.connect(); try { await c.db('codelift').collection('selfhost_probe').updateOne({_id:'synthetic-0'},${insert ? "{$set:{historyProbe:'later-synthetic-write'}}" : "{$unset:{historyProbe:''}}"}); } finally { await c.close(); }`
    );
  try {
    await withRestore(
      "none",
      (result) => {
        assert.equal(result.status, 0, result.stderr);
        const restored = JSON.parse(result.stdout);
        assert.equal(restored.fingerprint, original, "restored data belongs to backup time");
        assert.equal(restored.candidateUntouched, true);
        assert.notEqual(
          fixture("fingerprint").fingerprint,
          original,
          "later candidate write survives"
        );
      },
      () => mutate(true)
    );
  } finally {
    mutate(false);
  }
});
