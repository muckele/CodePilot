import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { stateRoot } from "./state.mjs";

const compose = [
  "compose",
  "--env-file",
  `${stateRoot}/ops/compose.env`,
  "-f",
  "infra/compose.selfhost.yaml"
];
function run(args) {
  return spawnSync("docker", [...compose, ...args], { encoding: "utf8", timeout: 180_000 });
}

test("authenticated initialization waits for the Mongo process immediately after a stopped-container start", () => {
  assert.equal(run(["stop", "mongodb"]).status, 0);
  assert.equal(run(["up", "-d", "mongodb"]).status, 0);
  const result = run(["run", "--rm", "mongo-init"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("authenticated replica initialization succeeds twice and rejects a different member without reconfiguration", () => {
  for (let runNumber = 1; runNumber <= 2; runNumber++) {
    const result = run(["run", "--rm", "mongo-init"]);
    assert.equal(
      result.status,
      0,
      `initializer run ${runNumber}: ${result.stdout} ${result.stderr}`
    );
    assert.match(result.stdout, /rs0.*ready/);
  }
  const wrong = run(["run", "--rm", "-e", "MONGO_REPLICA_MEMBER=unexpected:27017", "mongo-init"]);
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stdout + wrong.stderr, /does not match|unexpected topology/i);
});
