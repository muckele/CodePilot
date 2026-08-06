import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const canonicalCurriculum = JSON.parse(
  await readFile(path.join(root, "codelift_ai_curriculum_seed_v2_2026.json"), "utf8")
);
const canonicalDayOne = canonicalCurriculum.days.find((day) => day.dayNumber === 1);
if (canonicalDayOne === undefined) {
  throw new Error("The canonical curriculum does not contain day 1.");
}
const expectedSummaryPayload = {
  title: canonicalCurriculum.title,
  dayCount: canonicalCurriculum.days.length,
  weekCount: canonicalCurriculum.weeks.length,
  resourceCount: Object.keys(canonicalCurriculum.resourceCatalog).length,
  dailyCoreMinutes: canonicalCurriculum.dailyCoreMinutes,
  privacy: "public curriculum only; no learner state"
};
const expectedDayPayload = {
  dayNumber: canonicalDayOne.dayNumber,
  weekNumber: canonicalDayOne.weekNumber,
  monthNumber: canonicalDayOne.monthNumber,
  title: canonicalDayOne.title,
  buildTask: canonicalDayOne.buildTask,
  tinyArtifact: canonicalDayOne.tinyArtifact,
  resources: canonicalDayOne.resourceLinks
};
const expectedCatalogPayload = { resources: canonicalCurriculum.resourceCatalog };

const child = spawn(process.execPath, [path.join(root, "services/mcp/server.mjs")], {
  stdio: ["pipe", "pipe", "inherit"]
});
child.stdout.setEncoding("utf8");

let pending = "";
const waiters = new Map();
child.stdout.on("data", (chunk) => {
  pending += chunk;
  const lines = pending.split(/\r?\n/u);
  pending = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim() === "") continue;
    const message = JSON.parse(line);
    waiters.get(message.id)?.(message);
  }
});

function call(message) {
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`MCP response ${message.id} timed out.`)),
      3_000
    );
    waiters.set(message.id, (response) => {
      clearTimeout(timeout);
      waiters.delete(message.id);
      resolve(response);
    });
  });
  child.stdin.write(`${JSON.stringify(message)}\n`);
  return promise;
}

const expectedToolNames = [
  "codelift_curriculum_summary",
  "codelift_curriculum_day",
  "codelift_resource_catalog"
];

function hasExactKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...expectedKeys].sort().join("\n")
  );
}

function hasSameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasForbiddenLearnerKey(value) {
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenLearnerKey(entry));
  if (value === null || typeof value !== "object") return false;
  const forbiddenKeys = new Set([
    "userId",
    "email",
    "session",
    "sessionId",
    "note",
    "reflection",
    "progress"
  ]);
  return Object.entries(value).some(
    ([key, entry]) => forbiddenKeys.has(key) || hasForbiddenLearnerKey(entry)
  );
}

function emptyObjectSchemaIsBounded(schema) {
  return (
    schema?.type === "object" &&
    schema.additionalProperties === false &&
    hasExactKeys(schema.properties, [])
  );
}

try {
  const initialized = await call({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "codelift-check", version: "0.1.0" }
    }
  });
  const listed = await call({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const summary = await call({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "codelift_curriculum_summary", arguments: {} }
  });
  const day = await call({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "codelift_curriculum_day", arguments: { dayNumber: 1 } }
  });
  const catalog = await call({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "codelift_resource_catalog", arguments: {} }
  });
  const invalidArguments = await call({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "codelift_curriculum_day", arguments: { dayNumber: 0 } }
  });
  const unknownTool = await call({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "codelift_write_progress", arguments: {} }
  });

  const listedTools = listed.result?.tools ?? [];
  const toolNames = listedTools.map((tool) => tool.name);
  const toolByName = new Map(listedTools.map((tool) => [tool.name, tool]));
  const daySchema = toolByName.get("codelift_curriculum_day")?.inputSchema;
  const exactToolAllowlist =
    toolNames.length === expectedToolNames.length &&
    new Set(toolNames).size === expectedToolNames.length &&
    expectedToolNames.every((name) => toolNames.includes(name));
  const schemasBounded =
    emptyObjectSchemaIsBounded(toolByName.get("codelift_curriculum_summary")?.inputSchema) &&
    emptyObjectSchemaIsBounded(toolByName.get("codelift_resource_catalog")?.inputSchema) &&
    daySchema?.type === "object" &&
    daySchema.additionalProperties === false &&
    hasExactKeys(daySchema.properties, ["dayNumber"]) &&
    daySchema.properties.dayNumber?.type === "integer" &&
    daySchema.properties.dayNumber.minimum === 1 &&
    daySchema.properties.dayNumber.maximum === 365 &&
    Array.isArray(daySchema.required) &&
    daySchema.required.length === 1 &&
    daySchema.required[0] === "dayNumber";

  const summaryPayload = summary.result?.structuredContent;
  const dayPayload = day.result?.structuredContent;
  const catalogPayload = catalog.result?.structuredContent;
  const catalogResources = catalogPayload?.resources;
  const summaryIsCanonicalPublic =
    hasExactKeys(summaryPayload, [
      "title",
      "dayCount",
      "weekCount",
      "resourceCount",
      "dailyCoreMinutes",
      "privacy"
    ]) && hasSameJsonValue(summaryPayload, expectedSummaryPayload);
  const dayIsCanonicalPublic =
    hasExactKeys(dayPayload, [
      "dayNumber",
      "weekNumber",
      "monthNumber",
      "title",
      "buildTask",
      "tinyArtifact",
      "resources"
    ]) &&
    Array.isArray(dayPayload.resources) &&
    hasSameJsonValue(dayPayload, expectedDayPayload);
  const catalogIsCanonicalPublic =
    hasExactKeys(catalogPayload, ["resources"]) &&
    catalogResources !== null &&
    typeof catalogResources === "object" &&
    !Array.isArray(catalogResources) &&
    Object.keys(catalogResources).length === 88 &&
    Object.values(catalogResources).every(
      (resource) =>
        hasExactKeys(resource, ["provider", "title", "url", "type"]) &&
        typeof resource.url === "string" &&
        resource.url.startsWith("https://")
    ) &&
    hasSameJsonValue(catalogPayload, expectedCatalogPayload);
  const publicPayloads = [summaryPayload, dayPayload, catalogPayload];
  const report = {
    initialized: initialized.result?.serverInfo?.name === "codelift-read-only-demo",
    toolCount: toolNames.length,
    tools: toolNames,
    exactToolAllowlist,
    schemasBounded,
    allToolsInvoked:
      summary.error === undefined && day.error === undefined && catalog.error === undefined,
    invalidArgumentsRejected: invalidArguments.error?.code === -32602,
    unknownToolRejected: unknownTool.error?.code === -32601,
    canonicalPublicOnly:
      summaryIsCanonicalPublic &&
      dayIsCanonicalPublic &&
      catalogIsCanonicalPublic &&
      !publicPayloads.some((payload) => hasForbiddenLearnerKey(payload)),
    passed: false
  };
  report.passed =
    report.initialized &&
    report.exactToolAllowlist &&
    report.schemasBounded &&
    report.allToolsInvoked &&
    report.invalidArgumentsRejected &&
    report.unknownToolRejected &&
    report.canonicalPublicOnly;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  child.stdin.end();
  child.kill("SIGTERM");
}
