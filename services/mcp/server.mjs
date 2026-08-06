#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const curriculum = JSON.parse(
  await readFile(path.join(repositoryRoot, "codelift_ai_curriculum_seed_v2_2026.json"), "utf8")
);
const byDay = new Map(curriculum.days.map((day) => [day.dayNumber, day]));

const tools = [
  {
    name: "codelift_curriculum_summary",
    description: "Read the public CodeLift curriculum summary. This tool never reads learner data.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  },
  {
    name: "codelift_curriculum_day",
    description:
      "Read one public curriculum day by number. This is a read-only, non-user-scoped demo.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        dayNumber: { type: "integer", minimum: 1, maximum: 365 }
      },
      required: ["dayNumber"]
    }
  },
  {
    name: "codelift_resource_catalog",
    description:
      "List the public official/free resource catalog without fetching third-party content.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  }
];

function result(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textContent(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError: false
  };
}

function handle(message) {
  if (message.method === "initialize") {
    return result(message.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "codelift-read-only-demo", version: "0.1.0" }
    });
  }
  if (message.method === "notifications/initialized") return null;
  if (message.method === "tools/list") return result(message.id, { tools });
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    if (name === "codelift_curriculum_summary") {
      return result(
        message.id,
        textContent({
          title: curriculum.title,
          dayCount: curriculum.days.length,
          weekCount: curriculum.weeks.length,
          resourceCount: Object.keys(curriculum.resourceCatalog).length,
          dailyCoreMinutes: curriculum.dailyCoreMinutes,
          privacy: "public curriculum only; no learner state"
        })
      );
    }
    if (name === "codelift_curriculum_day") {
      if (!Number.isInteger(args.dayNumber) || args.dayNumber < 1 || args.dayNumber > 365) {
        return error(message.id, -32602, "dayNumber must be an integer from 1 through 365.");
      }
      const day = byDay.get(args.dayNumber);
      return result(
        message.id,
        textContent({
          dayNumber: day.dayNumber,
          weekNumber: day.weekNumber,
          monthNumber: day.monthNumber,
          title: day.title,
          buildTask: day.buildTask,
          tinyArtifact: day.tinyArtifact,
          resources: day.resourceLinks
        })
      );
    }
    if (name === "codelift_resource_catalog") {
      return result(message.id, textContent({ resources: curriculum.resourceCatalog }));
    }
    return error(message.id, -32601, "Unknown or non-allowlisted tool.");
  }
  if (message.id === undefined) return null;
  return error(message.id, -32601, "Method not found.");
}

let pending = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  pending += chunk;
  const lines = pending.split(/\r?\n/u);
  pending = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim() === "") continue;
    let response;
    try {
      response = handle(JSON.parse(line));
    } catch {
      response = error(null, -32700, "Parse error.");
    }
    if (response !== null) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
});
