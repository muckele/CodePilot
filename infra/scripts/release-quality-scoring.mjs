import { BROWSER_EVIDENCE_VERSION } from "./browser-evidence-contract.mjs";

export const REQUIRED_RELEASE_COMMANDS = Object.freeze([
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
]);

export const CRITICAL_RELEASE_COMMANDS = Object.freeze([
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

export const RELEASE_CATEGORY_WEIGHTS = Object.freeze({
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

export const RELEASE_PASSING_SCORE = 95;

export function visualAccessibilityCategoryScore({
  e2ePassed,
  browserCommandPassed,
  evidenceVersion,
  browserEvidencePassed
}) {
  return e2ePassed &&
    browserCommandPassed &&
    evidenceVersion === BROWSER_EVIDENCE_VERSION &&
    browserEvidencePassed
    ? RELEASE_CATEGORY_WEIGHTS.visualAccessibility
    : 0;
}

export function releaseQualityPassed({ score, failedCommands, criticalFailures }) {
  return (
    score >= RELEASE_PASSING_SCORE && failedCommands.length === 0 && criticalFailures.length === 0
  );
}
