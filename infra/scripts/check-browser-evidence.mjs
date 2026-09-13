import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const evidencePath = path.join(root, "docs", "quality", "release-manual.json");
const reportPath = path.join(root, "reports", "browser-evidence.json");
const screenshotRoot = path.join(root, "docs", "quality", "screenshots");
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
const ignoredSourceSegments = new Set([
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

function isIgnoredSourcePath(candidate) {
  const segments = candidate.split(path.sep);
  return (
    segments.some((segment) => ignoredSourceSegments.has(segment)) ||
    candidate.endsWith(".pyc") ||
    candidate.endsWith(".tsbuildinfo")
  );
}

async function listFiles(candidate) {
  if (isIgnoredSourcePath(candidate)) return [];
  const absolutePath = path.join(root, candidate);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (entries === null) return [candidate];
  return (
    await Promise.all(
      entries
        .filter((entry) => !ignoredSourceSegments.has(entry.name))
        .map((entry) => listFiles(path.join(candidate, entry.name)))
    )
  ).flat();
}

async function calculateSourceDigest() {
  const files = (await Promise.all(reviewedRoots.map(listFiles)))
    .flat()
    .filter((file) => !isIgnoredSourcePath(file))
    .sort((left, right) => left.localeCompare(right));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(root, file)));
    hash.update("\0");
  }
  return { algorithm: "sha256", digest: hash.digest("hex"), files };
}

const source = await calculateSourceDigest();
if (process.argv.includes("--print-digest")) {
  process.stdout.write(`${source.digest}\n`);
  process.exit(0);
}

const issues = [];
let evidence = null;
try {
  evidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch {
  issues.push("Release browser evidence is missing or invalid JSON.");
}

const requiredBooleanChecks = [
  "responsiveWide",
  "responsiveNarrow",
  "darkTheme",
  "reducedMotion",
  "keyboard",
  "focusManagement",
  "headingsAndLandmarks",
  "noColorOnlyMeaning",
  "goldenPath",
  "missedDayContinue",
  "recoveryDistinct",
  "providerFallback",
  "ragCitation",
  "ragAbstention",
  "tenantIsolation",
  "plannerApproval",
  "accountDeletion",
  "errorRecovery",
  "passwordLogin",
  "globalSignOut",
  "failedLogoutTruthful",
  "passwordResetEmail",
  "passwordResetGeneric",
  "passwordResetSessionInvalidation",
  "emailLoginCode",
  "emailLoginWrongRejected",
  "emailLoginReusedRejected",
  "emailLoginExpiredRejected",
  "authReturnTo",
  "fakeEmailOutboxGuarded",
  "noConsoleErrors"
];
const requiredPages = [
  "Today",
  "Roadmap",
  "Reviews",
  "Skills",
  "Portfolio",
  "Error Museum",
  "AI Coach",
  "Search / RAG",
  "Planner",
  "Evals",
  "Settings",
  "Login",
  "Forgot password",
  "Email sign-in code"
];

const requiredAuthScreenshots = [
  "docs/quality/screenshots/v0.1.1-login-email-alternatives.png",
  "docs/quality/screenshots/v0.1.1-generic-reset-status.png",
  "docs/quality/screenshots/v0.1.1-email-code-empty-320.png",
  "docs/quality/screenshots/v0.1.1-global-sign-out.png"
];

const forbiddenEvidenceValues = [
  { label: "email recipient", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu },
  { label: "six-digit login code", pattern: /\b[0-9]{6}\b/u },
  { label: "URL fragment credential", pattern: /#(?:invite|token)=/iu },
  { label: "cookie material", pattern: /codelift_session=/iu },
  { label: "CSRF or access token", pattern: /\b[A-Za-z0-9_-]{43}\b/u },
  { label: "Resend credential", pattern: /\bre_[A-Za-z0-9_-]+/u },
  {
    label: "private temporary path",
    pattern: /(?:\/private\/var\/folders|\/var\/folders|\/tmp\/)/u
  },
  { label: "test password", pattern: /Playwright(?:-only| replacement)/u }
];

function sensitiveValueIssues(value, location) {
  if (typeof value === "string") {
    return forbiddenEvidenceValues
      .filter(({ pattern }) => pattern.test(value))
      .map(({ label }) => `${location} contains forbidden ${label}.`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => sensitiveValueIssues(item, `${location}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      sensitiveValueIssues(item, `${location}.${key}`)
    );
  }
  return [];
}

if (evidence !== null) {
  if (evidence.evidenceVersion !== 3) issues.push("Browser evidenceVersion must be 3.");
  issues.push(...sensitiveValueIssues(evidence, "browser evidence"));
  if (evidence.sourceDigest !== source.digest) {
    issues.push("Browser evidence is stale because the reviewed source digest changed.");
  }
  const observedAtMs =
    typeof evidence.observedAt === "string" ? Date.parse(evidence.observedAt) : Number.NaN;
  if (Number.isNaN(observedAtMs)) {
    issues.push("Browser evidence must include a valid observedAt timestamp.");
  } else {
    const now = Date.now();
    const maximumAgeMs = 30 * 24 * 60 * 60 * 1_000;
    if (observedAtMs > now) {
      issues.push("Browser evidence observedAt cannot be in the future.");
    }
    if (observedAtMs < now - maximumAgeMs) {
      issues.push("Browser evidence is older than 30 days and must be refreshed.");
    }
  }
  for (const field of requiredBooleanChecks) {
    if (evidence[field] !== true) issues.push(`Browser evidence field ${field} is not true.`);
  }
  if (!Array.isArray(evidence.pagesVerified)) {
    issues.push("Browser evidence pagesVerified must be an array.");
  } else {
    for (const page of requiredPages) {
      if (!evidence.pagesVerified.includes(page)) {
        issues.push(`Required private page was not verified: ${page}.`);
      }
    }
  }
  if (
    evidence.measurements?.narrow?.viewportWidth !== 320 ||
    evidence.measurements?.narrow?.horizontalOverflow !== false
  ) {
    issues.push("Evidence must record a 320px viewport with no horizontal overflow.");
  }
  if (
    evidence.measurements?.wide?.viewportWidth < 1200 ||
    evidence.measurements?.wide?.horizontalOverflow !== false
  ) {
    issues.push("Evidence must record a wide viewport with no horizontal overflow.");
  }
  if (evidence.measurements?.wide?.coreMinutes !== 30) {
    issues.push("Evidence must record a visible 30-minute Core total.");
  }
  if (!Array.isArray(evidence.screenshots)) {
    issues.push("Browser evidence screenshots must be an array.");
  } else {
    if (evidence.screenshots.length < 4) {
      issues.push("At least four local browser screenshots are required.");
    }
    for (const requiredScreenshot of requiredAuthScreenshots) {
      if (!evidence.screenshots.includes(requiredScreenshot)) {
        issues.push(`Required v0.1.1 auth screenshot is missing: ${requiredScreenshot}.`);
      }
    }
    const seenScreenshots = new Set();
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const resolvedScreenshotRoot = await realpath(screenshotRoot).catch(() => screenshotRoot);
    for (const screenshot of evidence.screenshots) {
      if (typeof screenshot !== "string") {
        issues.push("Every screenshot entry must be a repository-relative path.");
        continue;
      }
      const portablePath = screenshot.replaceAll("\\", "/");
      const normalizedPath = path.posix.normalize(portablePath);
      if (
        screenshot !== portablePath ||
        portablePath !== normalizedPath ||
        path.posix.isAbsolute(normalizedPath) ||
        !normalizedPath.startsWith("docs/quality/screenshots/") ||
        path.posix.extname(normalizedPath).toLowerCase() !== ".png"
      ) {
        issues.push(
          `Screenshot must be a normalized repository PNG under docs/quality/screenshots: ${screenshot}.`
        );
        continue;
      }
      if (seenScreenshots.has(normalizedPath)) {
        issues.push(`Screenshot entries must be distinct: ${normalizedPath}.`);
        continue;
      }
      seenScreenshots.add(normalizedPath);
      try {
        const absolutePath = path.resolve(root, normalizedPath);
        const resolvedPath = await realpath(absolutePath);
        if (!resolvedPath.startsWith(`${resolvedScreenshotRoot}${path.sep}`)) {
          issues.push(`Screenshot resolves outside docs/quality/screenshots: ${normalizedPath}.`);
          continue;
        }
        const image = await readFile(resolvedPath);
        let textualMetadata = "";
        for (let offset = 8; offset + 12 <= image.length;) {
          const length = image.readUInt32BE(offset);
          const type = image.subarray(offset + 4, offset + 8).toString("ascii");
          const dataStart = offset + 8;
          const dataEnd = dataStart + length;
          if (dataEnd + 4 > image.length) break;
          if (type === "tEXt" || type === "iTXt") {
            textualMetadata += image.subarray(dataStart, dataEnd).toString("utf8");
          }
          offset = dataEnd + 4;
        }
        for (const { label, pattern } of forbiddenEvidenceValues) {
          if (pattern.test(textualMetadata)) {
            issues.push(`Screenshot contains forbidden ${label}: ${normalizedPath}.`);
          }
        }
        const hasPngHeader =
          image.length >= 24 &&
          image.subarray(0, pngSignature.length).equals(pngSignature) &&
          image.subarray(12, 16).toString("ascii") === "IHDR";
        if (!hasPngHeader) {
          issues.push(`Screenshot is not a valid PNG: ${normalizedPath}.`);
          continue;
        }
        const width = image.readUInt32BE(16);
        const height = image.readUInt32BE(20);
        if (width <= 0 || height <= 0) {
          issues.push(`Screenshot has invalid dimensions: ${normalizedPath}.`);
        }
      } catch {
        issues.push(`Screenshot is missing or unreadable: ${normalizedPath}.`);
      }
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  profile: "release-source-bound-browser-accessibility-evidence",
  passed: issues.length === 0,
  source,
  evidencePath: path.relative(root, evidencePath),
  observedAt: evidence?.observedAt ?? null,
  pagesVerified: evidence?.pagesVerified ?? [],
  issues
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
