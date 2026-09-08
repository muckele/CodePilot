import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("candidate runtime satisfies private ingress, authentication, replica, resource, transaction and export gates", () => {
  const result = spawnSync(process.execPath, ["infra/selfhost/cli.mjs", "check"], {
    encoding: "utf8",
    timeout: 120_000
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.services.length, 3);
  assert.equal(report.unauthenticatedDenied, true);
  assert.equal(report.fixture.transaction, true);
  assert.equal(report.fixture.committedDocumentWrites, 4);
  assert.equal(report.fixture.tenantIsolation, true);
  assert.equal(report.fixture.accountExport, true);
  assert.equal(report.secretLeaks, 0);
});
