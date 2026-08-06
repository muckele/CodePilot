import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distDirectory = path.join(root, "apps", "web", "dist");
const webEntryPath = path.join(root, "apps", "web", "src", "main.tsx");
const canonicalSeedPath = path.join(root, "codelift_ai_curriculum_seed_v2_2026.json");
const canonicalSeedFilename = path.basename(canonicalSeedPath);
const reportPath = path.join(root, "reports", "bundle.json");
const assetFiles = [];
const issues = [];

const sourceExtensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"];

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function walk(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, output);
    } else {
      output.push(absolutePath);
    }
  }
}

async function fileExists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const staticImport = /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/gu;
  const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/gu;
  const cssImport = /@import\s+(?:url\()?\s*["']([^"']+)["']/gu;
  for (const expression of [staticImport, dynamicImport, cssImport]) {
    for (const match of source.matchAll(expression)) {
      if (match[1] !== undefined) specifiers.add(match[1]);
    }
  }
  return [...specifiers];
}

async function resolveLocalImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const unresolved = path.resolve(path.dirname(importer), specifier);
  for (const extension of sourceExtensions) {
    const directCandidate = `${unresolved}${extension}`;
    if (await fileExists(directCandidate)) return directCandidate;
    const indexCandidate = path.join(unresolved, `index${extension}`);
    if (await fileExists(indexCandidate)) return indexCandidate;
  }
  return null;
}

function curriculumFingerprints(seed) {
  if (!Array.isArray(seed.days) || seed.days.length !== 365) {
    throw new Error("Canonical curriculum must contain exactly 365 days for bundle inspection.");
  }
  const dayIndexes = [
    0,
    Math.floor((seed.days.length - 1) / 4),
    Math.floor((seed.days.length - 1) / 2),
    Math.floor(((seed.days.length - 1) * 3) / 4),
    seed.days.length - 1
  ];
  const fingerprints = [];
  for (const index of dayIndexes) {
    const day = seed.days[index];
    for (const field of ["buildTask", "recoveryTask"]) {
      const value = day?.[field];
      if (typeof value === "string" && value.length >= 48) {
        fingerprints.push({
          id: `day-${String(day.dayNumber)}-${field}`,
          value,
          sha256: sha256(value)
        });
      }
    }
  }

  const resourceUrls = Object.entries(seed.resourceCatalog ?? {})
    .map(([resourceId, resource]) => ({ resourceId, url: resource?.url }))
    .filter((resource) => typeof resource.url === "string")
    .sort((left, right) => right.url.length - left.url.length)
    .slice(0, 3);
  for (const resource of resourceUrls) {
    fingerprints.push({
      id: `resource-${resource.resourceId}-url`,
      value: resource.url,
      sha256: sha256(resource.url)
    });
  }

  if (fingerprints.length < 8) {
    throw new Error("Canonical curriculum did not yield enough independent bundle fingerprints.");
  }
  return fingerprints;
}

function scanText(artifact, kind, text, fingerprints) {
  const markerHits = [
    ...new Set(
      [canonicalSeedFilename, relative(canonicalSeedPath)].filter((marker) => text.includes(marker))
    )
  ];
  const fingerprintHits = fingerprints
    .filter(({ value }) => {
      const escapedValue = JSON.stringify(value).slice(1, -1);
      return text.includes(value) || text.includes(escapedValue);
    })
    .map(({ id }) => id);
  return markerHits.length === 0 && fingerprintHits.length === 0
    ? null
    : { artifact, kind, markerHits, fingerprintHits };
}

async function inspectWebImportGraph(fingerprints) {
  const pending = [webEntryPath];
  const visited = new Set();
  const findings = [];
  const forbiddenImports = [];
  const unresolvedImports = [];

  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);
    const content = await readFile(file, "utf8");
    const finding = scanText(relative(file), "web-source", content, fingerprints);
    if (finding !== null) findings.push(finding);

    for (const specifier of importSpecifiers(content)) {
      if (
        specifier.includes(canonicalSeedFilename) ||
        specifier === "@codelift/curriculum" ||
        specifier.startsWith("@codelift/curriculum/")
      ) {
        forbiddenImports.push({ importer: relative(file), specifier });
      }
      const resolved = await resolveLocalImport(file, specifier);
      if (resolved !== null) {
        pending.push(resolved);
      } else if (specifier.startsWith(".")) {
        unresolvedImports.push({ importer: relative(file), specifier });
      }
    }
  }

  return {
    sourceFiles: [...visited].map(relative).sort(),
    findings,
    forbiddenImports,
    unresolvedImports
  };
}

await mkdir(path.dirname(reportPath), { recursive: true });

let canonicalSeed;
let canonicalSeedSource;
let fingerprints;
try {
  canonicalSeedSource = await readFile(canonicalSeedPath, "utf8");
  canonicalSeed = JSON.parse(canonicalSeedSource);
  fingerprints = curriculumFingerprints(canonicalSeed);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  const invalidSeedReport = {
    generatedAt: new Date().toISOString(),
    profile: "release-web-bundle",
    passed: false,
    issues: [`Canonical seed fingerprint setup failed: ${detail}`]
  };
  await writeFile(reportPath, `${JSON.stringify(invalidSeedReport, null, 2)}\n`, "utf8");
  process.stderr.write(`${JSON.stringify(invalidSeedReport, null, 2)}\n`);
  process.exit(1);
}

try {
  await stat(distDirectory);
  await walk(distDirectory, assetFiles);
} catch {
  const missingReport = {
    generatedAt: new Date().toISOString(),
    profile: "release-web-bundle",
    passed: false,
    issues: ["apps/web/dist is missing; run the production build first"]
  };
  await writeFile(reportPath, `${JSON.stringify(missingReport, null, 2)}\n`, "utf8");
  process.stderr.write(`${JSON.stringify(missingReport, null, 2)}\n`);
  process.exit(1);
}

const javascriptFiles = assetFiles.filter((file) => file.endsWith(".js"));
const sourceMapFiles = assetFiles.filter((file) => file.endsWith(".js.map"));
const seedFindings = [];
let rawBytes = 0;
let gzipBytes = 0;

for (const file of javascriptFiles) {
  const content = await readFile(file);
  rawBytes += content.byteLength;
  gzipBytes += gzipSync(content).byteLength;
  const finding = scanText(
    relative(file),
    "browser-javascript",
    content.toString("utf8"),
    fingerprints
  );
  if (finding !== null) seedFindings.push(finding);
}

const sourceMapSources = [];
for (const file of sourceMapFiles) {
  try {
    const sourceMap = JSON.parse(await readFile(file, "utf8"));
    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    const sourcesContent = Array.isArray(sourceMap.sourcesContent) ? sourceMap.sourcesContent : [];
    for (const [index, source] of sources.entries()) {
      if (typeof source !== "string") continue;
      sourceMapSources.push({ map: relative(file), source });
      const sourcePathFinding = scanText(
        `${relative(file)}:${source}`,
        "source-map-path",
        source,
        fingerprints
      );
      if (sourcePathFinding !== null) seedFindings.push(sourcePathFinding);
      const sourceContent = sourcesContent[index];
      if (typeof sourceContent === "string") {
        const sourceFinding = scanText(
          `${relative(file)}:${source}`,
          "source-map-content",
          sourceContent,
          fingerprints
        );
        if (sourceFinding !== null) seedFindings.push(sourceFinding);
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    issues.push(`Could not inspect source map ${relative(file)}: ${detail}`);
  }
}

let importGraph;
try {
  importGraph = await inspectWebImportGraph(fingerprints);
  seedFindings.push(...importGraph.findings);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  importGraph = {
    sourceFiles: [],
    findings: [],
    forbiddenImports: [],
    unresolvedImports: []
  };
  issues.push(`Could not inspect the web import graph: ${detail}`);
}

const negativeControlFingerprints = fingerprints.slice(0, 3);
const negativeControlFinding = scanText(
  "synthetic-negative-control",
  "negative-control",
  [canonicalSeedFilename, ...negativeControlFingerprints.map(({ value }) => value)].join("\n"),
  fingerprints
);
const negativeControlPassed =
  negativeControlFinding?.markerHits.includes(canonicalSeedFilename) === true &&
  negativeControlFingerprints.every(({ id }) =>
    negativeControlFinding.fingerprintHits.includes(id)
  );

const gzipBudgetBytes = 200 * 1024;
if (gzipBytes > gzipBudgetBytes) {
  issues.push(`JavaScript gzip total ${gzipBytes} exceeds ${gzipBudgetBytes} bytes`);
}
if (sourceMapFiles.length === 0) {
  issues.push("No production JavaScript source map was available for seed-exclusion inspection.");
}
if (importGraph.unresolvedImports.length > 0) {
  issues.push(
    `The web import graph contains unresolved local imports: ${importGraph.unresolvedImports
      .map(({ importer, specifier }) => `${importer} -> ${specifier}`)
      .join(", ")}`
  );
}
if (importGraph.forbiddenImports.length > 0) {
  issues.push(
    `The web import graph reaches a forbidden curriculum source: ${importGraph.forbiddenImports
      .map(({ importer, specifier }) => `${importer} -> ${specifier}`)
      .join(", ")}`
  );
}
if (seedFindings.length > 0) {
  issues.push(
    `Canonical seed evidence found in browser artifacts: ${seedFindings
      .map(
        ({ artifact, kind, markerHits, fingerprintHits }) =>
          `${artifact} (${kind}; markers=${markerHits.join("|") || "none"}; fingerprints=${fingerprintHits.join("|") || "none"})`
      )
      .join(", ")}`
  );
}
if (!negativeControlPassed) {
  issues.push("Canonical seed detector failed its synthetic negative self-control.");
}

const canonicalSeedExcluded =
  sourceMapFiles.length > 0 &&
  seedFindings.length === 0 &&
  importGraph.forbiddenImports.length === 0 &&
  importGraph.unresolvedImports.length === 0;
const report = {
  generatedAt: new Date().toISOString(),
  profile: "release-web-bundle",
  javascriptFiles: javascriptFiles.map(relative),
  sourceMapFiles: sourceMapFiles.map(relative),
  rawBytes,
  gzipBytes,
  gzipBudgetBytes,
  canonicalSeedInspection: {
    seedPath: relative(canonicalSeedPath),
    seedSha256: sha256(canonicalSeedSource),
    fingerprintCount: fingerprints.length,
    fingerprints: fingerprints.map(({ id, sha256: fingerprintSha256 }) => ({
      id,
      sha256: fingerprintSha256
    })),
    importGraphSourceFiles: importGraph.sourceFiles,
    sourceMapSourceCount: sourceMapSources.length,
    findings: seedFindings,
    forbiddenImports: importGraph.forbiddenImports,
    unresolvedImports: importGraph.unresolvedImports,
    negativeControl: {
      injectedFingerprintIds: negativeControlFingerprints.map(({ id }) => id),
      detectedMarkerCount: negativeControlFinding?.markerHits.length ?? 0,
      detectedFingerprintCount: negativeControlFinding?.fingerprintHits.length ?? 0,
      passed: negativeControlPassed
    }
  },
  canonicalSeedExcluded,
  issues,
  passed: issues.length === 0 && canonicalSeedExcluded
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!report.passed) {
  process.exitCode = 1;
}
