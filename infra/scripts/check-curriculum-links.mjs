import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "codelift_ai_curriculum_seed_v2_2026.json");
const reportPath = path.join(root, "reports", "curriculum-links.json");
const timeoutMs = Number(process.env.CURRICULUM_LINK_TIMEOUT_MS ?? "3000");
const concurrency = Number(process.env.CURRICULUM_LINK_CONCURRENCY ?? "10");
const liveEnabled = process.env.CURRICULUM_LINK_LIVE !== "false";

if (
  !Number.isInteger(timeoutMs) ||
  timeoutMs < 500 ||
  timeoutMs > 15_000 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 24
) {
  throw new Error("Curriculum link timeout/concurrency configuration is outside safe bounds.");
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const catalog = source.resourceCatalog ?? {};
const issues = [];
const uniqueUrls = new Map();
let referenceCount = 0;

for (const [id, resource] of Object.entries(catalog)) {
  try {
    const url = new URL(resource.url);
    if (url.protocol !== "https:") {
      issues.push({ code: "NON_HTTPS_CATALOG_URL", id, url: resource.url });
    }
    const current = uniqueUrls.get(url.href) ?? { url: url.href, resourceIds: [] };
    current.resourceIds.push(id);
    uniqueUrls.set(url.href, current);
  } catch {
    issues.push({ code: "MALFORMED_CATALOG_URL", id, url: resource.url });
  }
}

for (const day of source.days ?? []) {
  const embeddedLinks = new Map(
    (day.resourceLinks ?? []).map((resource) => [resource.id, resource])
  );
  for (const id of day.resourceIds ?? []) {
    referenceCount += 1;
    const catalogResource = catalog[id];
    const embedded = embeddedLinks.get(id);
    if (!catalogResource) {
      issues.push({ code: "UNKNOWN_RESOURCE_ID", dayNumber: day.dayNumber, id });
      continue;
    }
    if (!embedded) {
      issues.push({ code: "MISSING_EMBEDDED_LINK", dayNumber: day.dayNumber, id });
      continue;
    }
    for (const field of ["provider", "title", "url", "type"]) {
      if (embedded[field] !== catalogResource[field]) {
        issues.push({
          code: "EMBEDDED_CATALOG_DRIFT",
          dayNumber: day.dayNumber,
          id,
          field
        });
      }
    }
  }
  for (const id of embeddedLinks.keys()) {
    if (!(day.resourceIds ?? []).includes(id)) {
      issues.push({ code: "UNREFERENCED_EMBEDDED_LINK", dayNumber: day.dayNumber, id });
    }
  }
}

async function attempt(url, method) {
  const headers =
    method === "GET"
      ? {
          Range: "bytes=0-0",
          "User-Agent": "CodeLift-Curriculum-Link-Maintenance/2.0"
        }
      : { "User-Agent": "CodeLift-Curriculum-Link-Maintenance/2.0" };
  const response = await fetch(url, {
    method,
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return {
    httpStatus: response.status,
    finalUrl: response.url,
    method
  };
}

async function inspectLive(entry) {
  if (!liveEnabled) {
    return {
      ...entry,
      status: "unknown",
      evidence: "Live check explicitly disabled with CURRICULUM_LINK_LIVE=false."
    };
  }
  let lastError = "No request completed.";
  for (let round = 0; round < 2; round += 1) {
    for (const method of ["HEAD", "GET"]) {
      try {
        const result = await attempt(entry.url, method);
        if (result.httpStatus >= 200 && result.httpStatus < 400) {
          return { ...entry, status: "reachable", ...result };
        }
        if (method === "GET" && (result.httpStatus === 404 || result.httpStatus === 410)) {
          return { ...entry, status: "unreachable", ...result };
        }
        lastError = `${method} returned HTTP ${result.httpStatus}.`;
        if (
          method === "GET" &&
          ![403, 405, 408, 425, 429, 500, 502, 503, 504].includes(result.httpStatus)
        ) {
          return { ...entry, status: "unknown", ...result, evidence: lastError };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown network error.";
      }
    }
  }
  return { ...entry, status: "unknown", evidence: lastError };
}

function confirmedUnreachableIssues(results) {
  return results
    .filter((entry) => entry.status === "unreachable")
    .map((entry) => ({
      code: "CONFIRMED_UNREACHABLE_RESOURCE",
      url: entry.url,
      resourceIds: entry.resourceIds,
      httpStatus: entry.httpStatus,
      finalUrl: entry.finalUrl,
      method: entry.method
    }));
}

const policyNegativeControlsPassed =
  confirmedUnreachableIssues([
    {
      url: "https://example.invalid/gone",
      resourceIds: ["negative-control"],
      status: "unreachable",
      httpStatus: 410,
      finalUrl: "https://example.invalid/gone",
      method: "GET"
    }
  ]).length === 1 &&
  confirmedUnreachableIssues([
    {
      url: "https://example.invalid/transient",
      resourceIds: ["negative-control"],
      status: "unknown",
      evidence: "Synthetic timeout."
    }
  ]).length === 0;

if (!policyNegativeControlsPassed) {
  throw new Error("Curriculum link policy negative controls failed.");
}

const queue = [...uniqueUrls.values()];
const liveResults = [];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const index = cursor;
    cursor += 1;
    const entry = queue[index];
    if (entry !== undefined) liveResults[index] = await inspectLive(entry);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

issues.push(...confirmedUnreachableIssues(liveResults));

const counts = {
  reachable: liveResults.filter((entry) => entry.status === "reachable").length,
  unknown: liveResults.filter((entry) => entry.status === "unknown").length,
  unreachable: liveResults.filter((entry) => entry.status === "unreachable").length
};
const report = {
  generatedAt: new Date().toISOString(),
  checkProfile: "static-fidelity-and-bounded-live-reachability",
  configuration: { liveEnabled, timeoutMs, concurrency, retries: 1, headThenGet: true },
  catalogEntries: Object.keys(catalog).length,
  uniqueUrls: uniqueUrls.size,
  dayResourceReferences: referenceCount,
  counts,
  liveResults,
  issues,
  policyNegativeControlsPassed,
  policy:
    "Malformed URLs, unknown IDs, source/catalog drift, and confirmed GET 404/410 responses fail. Transient blocks, rate limits, and network failures remain unknown with evidence and do not fail or delete a resource.",
  passed: policyNegativeControlsPassed && issues.length === 0
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
