import assert from "node:assert/strict";
import test from "node:test";

import { fullSourceStatusArguments, releaseSourceState } from "./release-source-state.mjs";

test("requests every untracked path when checking release-source cleanliness", () => {
  assert.deepEqual(fullSourceStatusArguments, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all"
  ]);
});

test("binds release evidence to one clean revision at both ends", () => {
  assert.deepEqual(
    releaseSourceState({
      startRevision: "a".repeat(40),
      startStatus: "",
      endRevision: "a".repeat(40),
      endStatus: ""
    }),
    { startClean: true, endClean: true, revisionStable: true, valid: true }
  );

  for (const invalid of [
    { startStatus: "?? hidden-source.ts", endStatus: "", endRevision: "a".repeat(40) },
    { startStatus: "", endStatus: " M changed.ts", endRevision: "a".repeat(40) },
    { startStatus: "", endStatus: "", endRevision: "b".repeat(40) }
  ]) {
    assert.equal(
      releaseSourceState({
        startRevision: "a".repeat(40),
        startStatus: invalid.startStatus,
        endRevision: invalid.endRevision,
        endStatus: invalid.endStatus
      }).valid,
      false
    );
  }
});
