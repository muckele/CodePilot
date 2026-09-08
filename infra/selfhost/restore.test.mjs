import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withRestore } from "./test-support/restore.mjs";
import { compose, docker, fixture } from "./operations.mjs";
import { stateRoot } from "./state.mjs";

test("restore waits for a delayed fresh Mongo socket before authenticated initialization", async () => {
  await withRestore("delayed-bootstrap", (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "pass");
  });
});

test("a staging-cleanup failure still tears down other restore resources and cannot record pass", async () => {
  await withRestore("cleanup-failure", (result, backup) => {
    assert.notEqual(result.status, 0);
    const evidence = JSON.parse(readFileSync(join(stateRoot, "evidence/restore.json"), "utf8"));
    const resources = JSON.parse(
      readFileSync(join(stateRoot, "evidence/restore-resources.json"), "utf8")
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
  await withRestore("cleanup-failure-retained", (result) => {
    assert.notEqual(result.status, 0);
    const evidence = JSON.parse(readFileSync(join(stateRoot, "evidence/restore.json"), "utf8"));
    const resources = JSON.parse(
      readFileSync(join(stateRoot, "evidence/restore-resources.json"), "utf8")
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
