import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { fullSourceStatusArguments, releaseSourceState } from "./release-source-state.mjs";

const root = process.cwd();
const reportPath = path.join(root, "reports", "release-quality.json");
const qualityStartedAtMs = Date.now();
const pnpmCli = process.env.npm_execpath;
const requiredCommands = [
  {
    id: "install:frozen",
    script: "install",
    argumentsValue: ["install", "--frozen-lockfile", "--offline"]
  },
  { id: "format:check", script: "format:check" },
  { id: "lint", script: "lint" },
  { id: "typecheck", script: "typecheck" },
  { id: "test", script: "test" },
  { id: "test:integration", script: "test:integration" },
  { id: "test:e2e", script: "test:e2e" },
  { id: "browser:evidence", script: "browser:evidence" },
  { id: "build", script: "build" },
  { id: "seed:first", script: "seed" },
  { id: "seed:repeat", script: "seed" },
  { id: "seed:validate", script: "seed:validate" },
  { id: "curriculum:preflight", script: "curriculum:preflight" },
  { id: "curriculum:validate", script: "curriculum:validate" },
  { id: "curriculum:links", script: "curriculum:links" },
  { id: "eval:local", script: "eval:local" },
  { id: "mcp:check", script: "mcp:check" },
  { id: "security:check", script: "security:check" },
  { id: "security:audit", script: "security:audit" },
  { id: "python:lock-check", script: "python:lock-check" },
  { id: "python:audit", script: "python:audit" },
  { id: "image:audit", script: "image:audit" },
  { id: "mvp:check", script: "mvp:check" },
  { id: "performance:check", script: "performance:check" },
  { id: "compose:check", script: "compose:check" },
  { id: "compose:smoke", script: "compose:smoke" },
  { id: "fresh-clone:check", script: "fresh-clone:check" }
];
const criticalCommandSet = new Set([
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

function commandOutput(executable, argumentsValue) {
  const result = spawnSync(executable, argumentsValue, {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : null;
}

const sourceStartRevision = commandOutput("git", ["rev-parse", "HEAD"]);
const sourceStartStatus = commandOutput("git", fullSourceStatusArguments);
const sourceStartedClean = sourceStartRevision !== null && sourceStartStatus === "";

await mkdir(path.dirname(reportPath), { recursive: true });

const commandResults = (sourceStartedClean ? requiredCommands : []).map(
  ({ id, script, argumentsValue = [script] }) => {
    const startedAt = Date.now();
    if (pnpmCli === undefined || pnpmCli.trim() === "") {
      return {
        id,
        script,
        command: `pnpm ${argumentsValue.join(" ")}`,
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdoutTail: "",
        stderrTail: "npm_execpath is unavailable; the pinned pnpm runtime cannot be verified."
      };
    }
    const result = spawnSync(process.execPath, [pnpmCli, ...argumentsValue], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 15 * 1024 * 1024
    });
    return {
      id,
      script,
      command: `pnpm ${argumentsValue.join(" ")}`,
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
      durationMs: Date.now() - startedAt,
      stdoutTail: (result.stdout ?? "").slice(-4_000),
      stderrTail: (result.stderr ?? "").slice(-4_000)
    };
  }
);

const sourceEndRevision = commandOutput("git", ["rev-parse", "HEAD"]);
const sourceEndStatus = commandOutput("git", fullSourceStatusArguments);
const sourceState = releaseSourceState({
  startRevision: sourceStartRevision,
  startStatus: sourceStartStatus,
  endRevision: sourceEndRevision,
  endStatus: sourceEndStatus
});
const sourceRevision = sourceStartRevision;
const sourceClean = sourceState.valid;
const pnpmVersion =
  pnpmCli === undefined || pnpmCli.trim() === ""
    ? null
    : commandOutput(process.execPath, [pnpmCli, "--version"]);

const passed = (script) => {
  const matches = commandResults.filter((result) => result.script === script);
  return matches.length > 0 && matches.every((result) => result.status === "passed");
};
const all = (...scripts) => scripts.every((script) => passed(script));

const requiredDocumentation = [
  "AGENTS.md",
  "PLANS.md",
  "README.md",
  "SECURITY.md",
  "docs/architecture/system.md",
  "docs/adr/0003-mongo-opaque-session-auth.md",
  "docs/adr/0004-typescript-monorepo-and-python-boundary.md",
  "docs/adr/0005-tenant-scoped-vector-abstraction.md",
  "docs/adr/0006-bounded-approval-gated-planner.md",
  "docs/security/threat-model.md",
  "docs/evals/strategy.md",
  "docs/runbooks/ai-operations.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/data-lifecycle.md",
  "docs/curriculum/maintenance.md",
  "docs/deployment.md",
  "docs/release-checklist.md",
  "docs/portfolio/demo-script.md",
  "docs/portfolio/resume-bullets.md",
  "docs/portfolio/system-design-walkthrough.md",
  "docs/known-limitations.md"
];
const fileChecks = await Promise.all(
  requiredDocumentation.map(async (file) => {
    try {
      const metadata = await stat(path.join(root, file));
      return { file, present: true, nonEmpty: metadata.isFile() && metadata.size > 0 };
    } catch {
      return { file, present: false, nonEmpty: false };
    }
  })
);
const documentationPresent = fileChecks.every((entry) => entry.present && entry.nonEmpty);

async function optionalJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

async function optionalText(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch {
    return null;
  }
}

const [readmeText, plansText, architectureText, evalStrategyText, limitationsText, resumeText] =
  await Promise.all([
    optionalText("README.md"),
    optionalText("PLANS.md"),
    optionalText("docs/architecture/system.md"),
    optionalText("docs/evals/strategy.md"),
    optionalText("docs/known-limitations.md"),
    optionalText("docs/portfolio/resume-bullets.md")
  ]);
const documentationContentChecks = [
  {
    id: "admin-route-truth",
    passed:
      readmeText?.includes("`/admin`") === true && readmeText?.includes("`/app/admin`") !== true
  },
  {
    id: "behavioral-eval-count",
    passed:
      readmeText?.includes("38 executable") === true &&
      plansText?.includes("38/38") === true &&
      evalStrategyText?.includes("Its 38 strict executable cases") === true &&
      resumeText?.includes("38-case executable") === true
  },
  {
    id: "workspace-package-inventory",
    passed: ["packages/config", "packages/evals", "packages/ui"].every(
      (packagePath) =>
        readmeText?.includes(packagePath) === true &&
        architectureText?.includes(packagePath) === true
    )
  },
  {
    id: "release-command-inventory",
    passed:
      readmeText?.includes("pnpm browser:evidence") === true &&
      readmeText?.includes("pnpm compose:smoke") === true &&
      readmeText?.includes("pnpm fresh-clone:check") === true &&
      (readmeText?.match(/^pnpm seed$/gmu)?.length ?? 0) >= 2
  },
  {
    id: "planner-proposal-only-truth",
    passed:
      readmeText?.includes("`proposal_only`") === true &&
      limitationsText?.includes("`proposal_only`") === true
  },
  {
    id: "release-screenshot-inventory",
    passed:
      readmeText?.includes("docs/quality/screenshots/release-today-wide.png") === true &&
      readmeText?.includes("docs/quality/screenshots/release-today-320.png") === true &&
      readmeText?.includes("docs/quality/screenshots/release-dark-reduced.png") === true &&
      readmeText?.includes("docs/quality/screenshots/release-rag-citations.png") === true
  },
  {
    id: "no-stale-release-claims",
    passed:
      plansText?.includes("known failing account-flow") !== true &&
      plansText?.includes("twelve-case") !== true &&
      plansText?.includes("passed: 12/12") !== true &&
      resumeText?.includes("twelve-case") !== true
  }
];
const documentationConsistent = documentationContentChecks.every((entry) => entry.passed);

const [manual, curriculum, links, localEval, security, bundle, browser, composeSmoke, freshClone] =
  await Promise.all([
    optionalJson("docs/quality/release-manual.json"),
    optionalJson("reports/curriculum-validation.json"),
    optionalJson("reports/curriculum-links.json"),
    optionalJson("reports/local-ai-eval.json"),
    optionalJson("reports/security.json"),
    optionalJson("reports/bundle.json"),
    optionalJson("reports/browser-evidence.json"),
    optionalJson("reports/compose-fallback-smoke.json"),
    optionalJson("reports/fresh-clone.json")
  ]);

const requiredFreshArtifacts = [
  "reports/curriculum-validation.json",
  "reports/curriculum-links.json",
  "reports/local-ai-eval.json",
  "reports/security.json",
  "reports/bundle.json",
  "reports/browser-evidence.json",
  "reports/compose-fallback-smoke.json",
  "reports/fresh-clone.json"
];
const artifactFreshness = await Promise.all(
  requiredFreshArtifacts.map(async (file) => {
    try {
      const metadata = await stat(path.join(root, file));
      return {
        file,
        modifiedAt: metadata.mtime.toISOString(),
        fresh: metadata.mtimeMs >= qualityStartedAtMs - 2_000
      };
    } catch {
      return { file, modifiedAt: null, fresh: false };
    }
  })
);
const allArtifactsFresh = artifactFreshness.every((entry) => entry.fresh);

const canonicalEvalDatasetRaw = await optionalText("evals/datasets/local-safety-v1.json");
let evaluatorRuntime = null;
let canonicalEvalDataset = null;
let canonicalEvalDatasetHash = null;
try {
  evaluatorRuntime = await import(new URL("../../packages/evals/dist/index.js", import.meta.url));
  if (canonicalEvalDatasetRaw !== null) {
    canonicalEvalDataset = evaluatorRuntime.parseEvalDataset(JSON.parse(canonicalEvalDatasetRaw));
    canonicalEvalDatasetHash = evaluatorRuntime.datasetSha256(canonicalEvalDatasetRaw);
  }
} catch {
  evaluatorRuntime = null;
  canonicalEvalDataset = null;
  canonicalEvalDatasetHash = null;
}

const sameJsonValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const evalCaseEvidenceValid = (entry, definition) => {
  if (
    evaluatorRuntime === null ||
    definition === undefined ||
    entry?.caseId !== definition.caseId ||
    entry?.category !== definition.category ||
    entry?.critical !== definition.critical ||
    entry?.scenarioKind !== definition.scenario.kind ||
    !sameJsonValue(entry?.input, definition.scenario.input) ||
    entry?.expectedBehavior !== definition.expectedBehavior ||
    !sameJsonValue(entry?.expectedAssertions, definition.assertions) ||
    entry?.observed === null ||
    typeof entry?.observed !== "object" ||
    !Array.isArray(entry?.assertions) ||
    entry.assertions.length !== definition.assertions.length ||
    typeof entry?.latencyMs !== "number" ||
    entry.latencyMs < 0 ||
    typeof entry?.estimatedCostUsd !== "number" ||
    entry.estimatedCostUsd < 0
  ) {
    return false;
  }
  const recomputed = definition.assertions.map((assertion) =>
    evaluatorRuntime.evaluateAssertion(assertion, entry.observed)
  );
  return (
    entry.assertions.every(
      (assertion, index) =>
        assertion?.passed === recomputed[index]?.passed &&
        sameJsonValue(assertion?.actual, recomputed[index]?.actual) &&
        sameJsonValue(assertion?.expected, recomputed[index]?.expected) &&
        assertion?.assertionId === recomputed[index]?.assertionId &&
        assertion?.field === recomputed[index]?.field &&
        assertion?.operator === recomputed[index]?.operator
    ) && entry?.passed === recomputed.every((assertion) => assertion.passed)
  );
};

const canonicalEvalCases = canonicalEvalDataset?.cases ?? [];
const observedEvalCases = Array.isArray(localEval?.cases) ? localEval.cases : [];
const derivedCriticalFailures = observedEvalCases
  .filter((entry) => entry?.critical === true && entry?.passed !== true)
  .map((entry) => entry.caseId);
const derivedEvalScore =
  observedEvalCases.length === 0
    ? 0
    : observedEvalCases.filter((entry) => entry?.passed === true).length / observedEvalCases.length;
const derivedEvalCost = observedEvalCases.reduce(
  (total, entry) =>
    total + (typeof entry?.estimatedCostUsd === "number" ? entry.estimatedCostUsd : 0),
  0
);
const derivedProviderCalls = observedEvalCases.reduce(
  (total, entry) =>
    total + (typeof entry?.observed?.outboundCalls === "number" ? entry.observed.outboundCalls : 0),
  0
);

const behavioralEvalEvidenceValid =
  evaluatorRuntime !== null &&
  canonicalEvalDataset !== null &&
  canonicalEvalDatasetHash !== null &&
  localEval?.evaluationProfile === "provider-independent-behavioral-v2" &&
  localEval?.evaluatorVersion === evaluatorRuntime.BEHAVIORAL_EVALUATOR_VERSION &&
  localEval.evaluatorVersion === canonicalEvalDataset.evaluatorVersion &&
  localEval?.dataset?.path === "evals/datasets/local-safety-v1.json" &&
  localEval?.dataset?.version === canonicalEvalDataset.version &&
  localEval?.dataset?.name === canonicalEvalDataset.name &&
  localEval?.dataset?.hash === canonicalEvalDatasetHash &&
  localEval?.dataset?.hashAlgorithm === "sha256" &&
  localEval?.dataset?.caseCount === canonicalEvalCases.length &&
  canonicalEvalCases.length >= 30 &&
  sameJsonValue(localEval?.providerConfig, {
    ...canonicalEvalDataset.providerConfig,
    datasetHashAlgorithm: "sha256",
    redactionPolicy: "synthetic-fixtures-only"
  }) &&
  localEval?.providerConfig?.externalCallsAllowed === false &&
  localEval?.externalNetworkCalls === 0 &&
  localEval?.modelDownloads === 0 &&
  observedEvalCases.length === canonicalEvalCases.length &&
  observedEvalCases.every((entry, index) =>
    evalCaseEvidenceValid(entry, canonicalEvalCases[index])
  ) &&
  localEval?.score === derivedEvalScore &&
  localEval?.passingScore === canonicalEvalDataset.passingScore &&
  localEval?.estimatedCostUsd === derivedEvalCost &&
  localEval?.providerCalls === derivedProviderCalls &&
  evaluatorRuntime.evaluatorNegativeControlsPass() === true &&
  localEval?.negativeControlsPassed === true &&
  sameJsonValue(localEval?.criticalFailures, derivedCriticalFailures) &&
  derivedCriticalFailures.length === 0 &&
  localEval?.passed === true;

const securityStructuralEvidenceValid =
  security?.passed === true &&
  security?.profile === "static-structural-security-evidence" &&
  security?.evidenceKind === "static_source_structure_not_behavioral_proof" &&
  security?.scannerNegativeControlsPassed === true &&
  sameJsonValue(security?.behavioralCompanionGates, ["test:integration", "test:e2e"]);

const categories = [
  {
    name: "User-visible acceptance criteria",
    maximum: 20,
    earned: all("test:integration", "test:e2e", "build") ? 20 : 0,
    evidence: ["test:integration", "test:e2e", "build"]
  },
  {
    name: "Type safety and runtime validation",
    maximum: 10,
    earned: all("typecheck", "lint") ? 10 : 0,
    evidence: ["typecheck", "lint"]
  },
  {
    name: "Unit/integration/E2E evidence",
    maximum: 15,
    earned: all("test", "test:integration", "test:e2e") ? 15 : 0,
    evidence: ["test", "test:integration", "test:e2e"]
  },
  {
    name: "Curriculum and seed integrity",
    maximum: 15,
    earned: all(
      "seed",
      "seed:validate",
      "curriculum:preflight",
      "curriculum:validate",
      "curriculum:links"
    )
      ? 15
      : 0,
    evidence: {
      commands: [
        "seed",
        "seed:validate",
        "curriculum:preflight",
        "curriculum:validate",
        "curriculum:links"
      ],
      dayCount: curriculum?.counts?.days ?? curriculum?.dayCount ?? null,
      resourceReferences: curriculum?.counts?.resourceLinks ?? null,
      liveLinkCounts: links?.counts ?? null
    }
  },
  {
    name: "Accessibility and responsive visual QA",
    maximum: 10,
    earned:
      all("test:e2e", "browser:evidence") &&
      manual?.evidenceVersion === 2 &&
      browser?.passed === true
        ? 10
        : 0,
    evidence: {
      commands: ["test:e2e", "browser:evidence"],
      sourceDigest: browser?.source?.digest ?? null,
      observedAt: manual?.observedAt ?? null,
      pagesVerified: manual?.pagesVerified ?? []
    }
  },
  {
    name: "Security and privacy",
    maximum: 10,
    earned:
      all(
        "security:check",
        "security:audit",
        "python:lock-check",
        "python:audit",
        "image:audit",
        "mvp:check",
        "test:integration",
        "test:e2e"
      ) && securityStructuralEvidenceValid
        ? 10
        : 0,
    evidence: {
      staticStructuralCommands: [
        "security:check",
        "security:audit",
        "python:lock-check",
        "python:audit",
        "image:audit",
        "mvp:check"
      ],
      behavioralCommands: ["test:integration", "test:e2e"],
      staticEvidenceKind: security?.evidenceKind ?? null,
      staticEvidenceBoundary: security?.evidenceBoundary ?? null,
      scannerNegativeControlsPassed: security?.scannerNegativeControlsPassed ?? null,
      structuralEvidenceValid: securityStructuralEvidenceValid,
      criticalFindings: security?.criticalFailures ?? null
    }
  },
  {
    name: "AI evals, grounding, and failure handling",
    maximum: 10,
    earned: all("eval:local", "test:integration") && behavioralEvalEvidenceValid ? 10 : 0,
    evidence: {
      commands: ["eval:local", "test:integration"],
      caseCount: localEval?.dataset?.caseCount ?? null,
      datasetHash: localEval?.dataset?.hash ?? null,
      evaluatorVersion: localEval?.evaluatorVersion ?? null,
      score: localEval?.score ?? null,
      providerCalls: localEval?.providerCalls ?? null,
      externalNetworkCalls: localEval?.externalNetworkCalls ?? null,
      negativeControlsPassed: localEval?.negativeControlsPassed ?? null,
      criticalFailures: localEval?.criticalFailures ?? null,
      behavioralEvidenceValid: behavioralEvalEvidenceValid
    }
  },
  {
    name: "Documentation and maintainability",
    maximum: 5,
    earned: documentationPresent && documentationConsistent ? 5 : 0,
    evidence: { files: fileChecks, contentConsistency: documentationContentChecks }
  },
  {
    name: "Performance, cost, and operational evidence",
    maximum: 5,
    earned:
      all(
        "performance:check",
        "compose:check",
        "compose:smoke",
        "fresh-clone:check",
        "mcp:check"
      ) &&
      composeSmoke?.passed === true &&
      freshClone?.passed === true
        ? 5
        : 0,
    evidence: {
      commands: [
        "performance:check",
        "compose:check",
        "compose:smoke",
        "fresh-clone:check",
        "mcp:check"
      ],
      gzipBytes: bundle?.gzipBytes ?? null,
      providerCostUsd: localEval?.estimatedCostUsd ?? null,
      composeFallback: composeSmoke?.observations ?? null,
      freshCloneRevision: freshClone?.cloneRevision ?? null
    }
  }
];

const score = categories.reduce((total, category) => total + category.earned, 0);
const failedCommands = commandResults
  .filter((result) => result.status === "failed")
  .map((result) => result.id);
const criticalFailures = commandResults
  .filter((result) => result.status === "failed" && criticalCommandSet.has(result.script))
  .map((result) => result.id);
if (!documentationPresent) criticalFailures.push("required-documentation-missing");
if (!documentationConsistent) criticalFailures.push("release-documentation-inconsistent");
if (security?.criticalFailures > 0) criticalFailures.push("critical-security-finding");
if (!securityStructuralEvidenceValid) {
  criticalFailures.push("static-security-evidence-invalid");
}
if (curriculum?.valid !== true || curriculum?.displayReady !== true) {
  criticalFailures.push("curriculum-not-display-ready");
}
if (!behavioralEvalEvidenceValid) criticalFailures.push("local-ai-behavioral-evidence-invalid");
if (process.version !== "v24.14.0" || pnpmVersion !== "11.9.0") {
  criticalFailures.push("unpinned-release-toolchain");
}
if (sourceRevision === null || !sourceClean) criticalFailures.push("release-source-not-clean");
if (!allArtifactsFresh) criticalFailures.push("stale-release-evidence");
if (
  freshClone?.passed !== true ||
  freshClone?.sourceWasClean !== true ||
  freshClone?.sourceRevision !== sourceRevision ||
  freshClone?.cloneRevision !== sourceRevision ||
  freshClone?.toolchain?.pnpmVersion !== "11.9.0" ||
  /^3\.12\.\d+(?:[A-Za-z0-9.+-]*)$/u.test(freshClone?.toolchain?.pythonVersion ?? "") !== true
) {
  criticalFailures.push("fresh-clone-evidence-invalid");
}
if (
  composeSmoke?.passed !== true ||
  composeSmoke?.sourceClean !== true ||
  composeSmoke?.revisionBound !== true ||
  composeSmoke?.sourceRevision !== sourceRevision
) {
  criticalFailures.push("compose-runtime-smoke-failed");
}
if (browser?.passed !== true) criticalFailures.push("browser-evidence-invalid");

const report = {
  generatedAt: new Date().toISOString(),
  milestone: "CodeLift AI V2 complete product release",
  source: {
    revision: sourceRevision,
    clean: sourceClean,
    startClean: sourceState.startClean,
    endClean: sourceState.endClean,
    revisionStable: sourceState.revisionStable,
    endRevision: sourceEndRevision,
    toolchain: { node: process.version, pnpm: pnpmVersion },
    qualityStartedAt: new Date(qualityStartedAtMs).toISOString()
  },
  score,
  passingScore: 95,
  passed: score >= 95 && failedCommands.length === 0 && criticalFailures.length === 0,
  categories,
  commandResults,
  failedCommands,
  criticalFailures,
  fileChecks,
  documentationContentChecks,
  artifactFreshness,
  measuredEvidence: {
    curriculum,
    links: links === null ? null : { counts: links.counts, issues: links.issues },
    localEval:
      localEval === null
        ? null
        : {
            dataset: localEval.dataset,
            evaluatorVersion: localEval.evaluatorVersion,
            score: localEval.score,
            providerCalls: localEval.providerCalls,
            externalNetworkCalls: localEval.externalNetworkCalls,
            estimatedProviderCostUsd: localEval.estimatedCostUsd,
            negativeControlsPassed: localEval.negativeControlsPassed,
            criticalFailures: localEval.criticalFailures
          },
    security:
      security === null
        ? null
        : {
            profile: security.profile,
            evidenceKind: security.evidenceKind,
            evidenceBoundary: security.evidenceBoundary,
            behavioralCompanionGates: security.behavioralCompanionGates,
            scannerNegativeControlsPassed: security.scannerNegativeControlsPassed,
            scannedFiles: security.scannedFiles,
            criticalFailures: security.criticalFailures
          },
    bundle,
    browser:
      manual === null || browser === null
        ? null
        : {
            sourceDigest: manual.sourceDigest,
            observedAt: manual.observedAt,
            pagesVerified: manual.pagesVerified,
            measurements: manual.measurements,
            validationPassed: browser.passed
          },
    composeSmoke,
    freshClone
  }
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
