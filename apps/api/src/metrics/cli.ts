import process from "node:process";

import { loadApiConfig } from "../config.js";
import { closePersistence, initializePersistence } from "../persistence/runtime.js";
import { buildPilotMetrics } from "./pilot-metrics.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

function parseDate(value: string | undefined, name: string, fallback?: Date): Date {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined) throw new Error(`--${name} is required and must be an ISO timestamp.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`--${name} must be an ISO timestamp.`);
  return parsed;
}

function currentUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const since = parseDate(option("since"), "since");
const until = parseDate(option("until"), "until", currentUtcMidnight());
if (since.getTime() >= until.getTime()) throw new Error("--since must be earlier than --until.");
const minimumCandidate = option("minimum-cohort") ?? "5";
if (!/^\d+$/.test(minimumCandidate)) throw new Error("--minimum-cohort must be an integer.");
const minimumCohortSize = Number(minimumCandidate);
if (minimumCohortSize < 5 || minimumCohortSize > 1_000) {
  throw new Error("--minimum-cohort must be from 5 through 1000.");
}

const config = loadApiConfig({
  ...process.env,
  REGISTRATION_MODE: process.env.REGISTRATION_MODE ?? "closed",
  PERSISTENCE_MODE: "required",
  MONGO_URI:
    process.env.MONGO_URI ??
    "mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true"
});
const persistence = await initializePersistence(config.persistence);
if (persistence.status !== "ready") throw new Error("MongoDB is required for pilot metrics.");

try {
  const report = await buildPilotMetrics(persistence.models, {
    since,
    until,
    minimumCohortSize
  });
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.suppressed) {
    process.stdout.write(
      [
        "CodeLift private-pilot metrics",
        `Window: [${report.window.since}, ${report.window.until})`,
        `Cohort: ${report.cohortSize} (minimum ${report.minimumCohortSize})`,
        `Suppressed: ${report.reason}`
      ].join("\n") + "\n"
    );
  } else {
    process.stdout.write(
      [
        "CodeLift private-pilot metrics",
        `Window: [${report.window.since}, ${report.window.until})`,
        `Cohort: ${report.cohortSize} (minimum ${report.minimumCohortSize})`,
        `Funnel: ${report.funnel.invited} invited -> ${report.funnel.registered} registered -> ${report.funnel.onboarded} onboarded -> ${report.funnel.firstMissionStarted} started -> ${report.funnel.firstValidCompletion} completed`,
        `Completion: ${report.completion.core} Core; ${report.completion.recovery} Recovery; ${report.completion.averageMinutesToFirstValidCompletion ?? "n/a"} average minutes to first valid completion`,
        `Return: ${report.return.nextDay} next-day; ${report.return.sevenDay} seven-day`,
        `Reliability: ${report.reliability.persistedSaveRecords} persisted saves; ${report.reliability.aiErrorRate ?? "n/a"} AI error; ${report.reliability.providerFallbackRate ?? "n/a"} fallback; ${report.reliability.ragAbstentionRate ?? "n/a"} RAG abstention`,
        `AI controls: kill switch ${report.reliability.agentKillSwitchEnabled === null ? "unknown" : report.reliability.agentKillSwitchEnabled ? "enabled" : "disabled"}; $${report.reliability.estimatedProviderCostUsd.toFixed(6)} estimated provider cost`,
        `Lifecycle: ${report.lifecycle.exportSuccesses} successful exports; ${report.lifecycle.deletionSuccesses} successful deletions`
      ].join("\n") + "\n"
    );
  }
} finally {
  await closePersistence(persistence);
}
