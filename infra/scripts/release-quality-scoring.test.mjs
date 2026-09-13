import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BROWSER_EVIDENCE_VERSION } from "./browser-evidence-contract.mjs";
import {
  CRITICAL_RELEASE_COMMANDS,
  RELEASE_CATEGORY_WEIGHTS,
  RELEASE_PASSING_SCORE,
  REQUIRED_RELEASE_COMMANDS,
  releaseQualityPassed,
  visualAccessibilityCategoryScore
} from "./release-quality-scoring.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const reviewedRoots = [
  ".dockerignore",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "playwright.config.ts",
  "apps/web",
  "apps/api",
  "packages",
  "e2e",
  "evals",
  "infra/compose.yaml",
  "infra/compose.m2.yaml",
  "infra/mongo",
  "infra/postgres",
  "codelift_ai_curriculum_seed_v2_2026.json",
  "services/ai",
  "services/mcp"
];
const ignoredCopySegments = new Set([
  ".git",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  ".vite",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "reports",
  "test-results"
]);

function copyFilter(candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" || !relative.split(path.sep).some((segment) => ignoredCopySegments.has(segment))
  );
}

async function copyEntry(fixtureRoot, relativePath) {
  const destination = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relativePath), destination, {
    recursive: true,
    filter: copyFilter
  });
}

async function browserFixture(t) {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "codelift-browser-contract-"));
  t.after(async () => rm(fixtureRoot, { recursive: true, force: true }));

  for (const relativePath of reviewedRoots) await copyEntry(fixtureRoot, relativePath);
  for (const relativePath of [
    "infra/scripts/browser-evidence-contract.mjs",
    "infra/scripts/check-browser-evidence.mjs",
    "docs/quality/release-manual.json",
    "docs/quality/screenshots"
  ]) {
    await copyEntry(fixtureRoot, relativePath);
  }
  return fixtureRoot;
}

async function readEvidence(fixtureRoot) {
  return JSON.parse(
    await readFile(path.join(fixtureRoot, "docs/quality/release-manual.json"), "utf8")
  );
}

async function writeEvidence(fixtureRoot, evidence) {
  await writeFile(
    path.join(fixtureRoot, "docs/quality/release-manual.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
}

async function validateBrowserEvidence(fixtureRoot) {
  const result = spawnSync(
    process.execPath,
    [path.join(fixtureRoot, "infra/scripts/check-browser-evidence.mjs")],
    { cwd: fixtureRoot, encoding: "utf8" }
  );
  const report = JSON.parse(
    await readFile(path.join(fixtureRoot, "reports/browser-evidence.json"), "utf8")
  );
  return { result, report };
}

function visualScore({ evidenceVersion, browserPassed, e2ePassed = true, commandPassed = true }) {
  return visualAccessibilityCategoryScore({
    e2ePassed,
    browserCommandPassed: commandPassed,
    evidenceVersion,
    browserEvidencePassed: browserPassed
  });
}

test("valid authoritative v3 browser evidence earns the existing visual QA points", async (t) => {
  const fixtureRoot = await browserFixture(t);
  const evidence = await readEvidence(fixtureRoot);
  const { result, report } = await validateBrowserEvidence(fixtureRoot);

  assert.equal(evidence.evidenceVersion, BROWSER_EVIDENCE_VERSION);
  assert.equal(result.status, 0);
  assert.equal(report.passed, true);
  assert.equal(
    visualScore({ evidenceVersion: evidence.evidenceVersion, browserPassed: report.passed }),
    10
  );
});

test("unsupported and legacy evidence versions remain ineligible", async (t) => {
  for (const evidenceVersion of [2, 4]) {
    const fixtureRoot = await browserFixture(t);
    const evidence = await readEvidence(fixtureRoot);
    evidence.evidenceVersion = evidenceVersion;
    await writeEvidence(fixtureRoot, evidence);

    const { result, report } = await validateBrowserEvidence(fixtureRoot);
    assert.equal(result.status, 1);
    assert.equal(report.passed, false);
    assert.match(report.issues.join("\n"), /evidenceVersion must be 3/u);
    assert.equal(visualScore({ evidenceVersion, browserPassed: report.passed }), 0);
  }
});

test("v3 evidence missing a required observation remains ineligible", async (t) => {
  const fixtureRoot = await browserFixture(t);
  const evidence = await readEvidence(fixtureRoot);
  delete evidence.passwordResetEmail;
  await writeEvidence(fixtureRoot, evidence);

  const { result, report } = await validateBrowserEvidence(fixtureRoot);
  assert.equal(result.status, 1);
  assert.equal(report.passed, false);
  assert.match(report.issues.join("\n"), /passwordResetEmail is not true/u);
  assert.equal(
    visualScore({ evidenceVersion: evidence.evidenceVersion, browserPassed: report.passed }),
    0
  );
});

test("missing and invalid required screenshots remain ineligible", async (t) => {
  {
    const fixtureRoot = await browserFixture(t);
    const evidence = await readEvidence(fixtureRoot);
    evidence.screenshots = evidence.screenshots.filter(
      (candidate) => !candidate.endsWith("v0.1.1-global-sign-out.png")
    );
    await writeEvidence(fixtureRoot, evidence);

    const { result, report } = await validateBrowserEvidence(fixtureRoot);
    assert.equal(result.status, 1);
    assert.equal(report.passed, false);
    assert.match(report.issues.join("\n"), /Required v0\.1\.1 auth screenshot is missing/u);
    assert.equal(
      visualScore({ evidenceVersion: evidence.evidenceVersion, browserPassed: report.passed }),
      0
    );
  }

  {
    const fixtureRoot = await browserFixture(t);
    const evidence = await readEvidence(fixtureRoot);
    const screenshot = evidence.screenshots.find((candidate) =>
      candidate.endsWith("v0.1.1-global-sign-out.png")
    );
    assert.equal(typeof screenshot, "string");
    await writeFile(path.join(fixtureRoot, screenshot), "not a png", "utf8");

    const { result, report } = await validateBrowserEvidence(fixtureRoot);
    assert.equal(result.status, 1);
    assert.equal(report.passed, false);
    assert.match(report.issues.join("\n"), /Screenshot is not a valid PNG/u);
    assert.equal(
      visualScore({ evidenceVersion: evidence.evidenceVersion, browserPassed: report.passed }),
      0
    );
  }
});

test("stale reviewed-source evidence remains ineligible", async (t) => {
  const fixtureRoot = await browserFixture(t);
  const evidence = await readEvidence(fixtureRoot);
  evidence.sourceDigest = "0".repeat(64);
  await writeEvidence(fixtureRoot, evidence);

  const { result, report } = await validateBrowserEvidence(fixtureRoot);
  assert.equal(result.status, 1);
  assert.equal(report.passed, false);
  assert.match(report.issues.join("\n"), /reviewed source digest changed/u);
  assert.equal(
    visualScore({ evidenceVersion: evidence.evidenceVersion, browserPassed: report.passed }),
    0
  );
});

test("v3 alone cannot earn points without validator and command prerequisites", () => {
  assert.equal(visualScore({ evidenceVersion: BROWSER_EVIDENCE_VERSION, browserPassed: false }), 0);
  assert.equal(
    visualScore({
      evidenceVersion: BROWSER_EVIDENCE_VERSION,
      browserPassed: true,
      e2ePassed: false
    }),
    0
  );
  assert.equal(
    visualScore({
      evidenceVersion: BROWSER_EVIDENCE_VERSION,
      browserPassed: true,
      commandPassed: false
    }),
    0
  );
});

test("unrelated release scoring weights, threshold, and command rules remain fixed", () => {
  assert.deepEqual(RELEASE_CATEGORY_WEIGHTS, {
    userVisibleAcceptance: 20,
    typeSafety: 10,
    testEvidence: 15,
    curriculumIntegrity: 15,
    visualAccessibility: 10,
    securityPrivacy: 10,
    aiEvals: 10,
    documentation: 5,
    operations: 5
  });
  assert.equal(RELEASE_PASSING_SCORE, 95);
  assert.deepEqual(
    REQUIRED_RELEASE_COMMANDS.map(({ id }) => id),
    [
      "install:frozen",
      "format:check",
      "lint",
      "typecheck",
      "test",
      "test:integration",
      "test:e2e",
      "browser:evidence",
      "build",
      "seed:first",
      "seed:repeat",
      "seed:validate",
      "curriculum:preflight",
      "curriculum:validate",
      "curriculum:links",
      "eval:local",
      "mcp:check",
      "security:check",
      "security:audit",
      "python:lock-check",
      "python:audit",
      "image:audit",
      "mvp:check",
      "performance:check",
      "compose:check",
      "compose:smoke",
      "fresh-clone:check"
    ]
  );
  assert.deepEqual(CRITICAL_RELEASE_COMMANDS, [
    "install",
    "typecheck",
    "test",
    "test:integration",
    "test:e2e",
    "browser:evidence",
    "build",
    "seed",
    "seed:validate",
    "curriculum:validate",
    "eval:local",
    "security:check",
    "python:lock-check",
    "python:audit",
    "image:audit",
    "mvp:check",
    "compose:smoke",
    "fresh-clone:check"
  ]);
  assert.equal(releaseQualityPassed({ score: 95, failedCommands: [], criticalFailures: [] }), true);
  assert.equal(
    releaseQualityPassed({ score: 94, failedCommands: [], criticalFailures: [] }),
    false
  );
  assert.equal(
    releaseQualityPassed({ score: 100, failedCommands: ["lint"], criticalFailures: [] }),
    false
  );
  assert.equal(
    releaseQualityPassed({ score: 100, failedCommands: [], criticalFailures: ["security"] }),
    false
  );
});
