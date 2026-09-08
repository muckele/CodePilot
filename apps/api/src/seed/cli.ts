import process from "node:process";

import { loadApiConfig } from "../config.js";
import { initializeCurriculum } from "../curriculum/runtime.js";
import { closePersistence, initializePersistence } from "../persistence/runtime.js";
import { seedGlobalData, validateSeededGlobalData } from "./global-seed.js";

const action = process.argv[2] ?? "seed";
if (action !== "seed" && action !== "validate") {
  throw new Error("Seed CLI action must be seed or validate.");
}

const environment: NodeJS.ProcessEnv = {
  ...process.env,
  PERSISTENCE_MODE: "required",
  ...(process.env.MONGO_URI === undefined && process.env.MONGO_URI_FILE === undefined
    ? { MONGO_URI: "mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true" }
    : {}),
  MONGO_DB_NAME: process.env.MONGO_DB_NAME ?? "codelift"
};
const config = loadApiConfig(environment);
const curriculum = await initializeCurriculum(config.curriculumPath);
if (curriculum.status !== "ready") {
  throw new Error("Curriculum validation failed; seed operation stopped.");
}
const persistence = await initializePersistence(config.persistence);
if (persistence.status !== "ready") {
  throw new Error("MongoDB is required for seed operations.");
}

try {
  if (action === "seed") {
    await seedGlobalData(persistence.models, curriculum);
  }
  const report = await validateSeededGlobalData(persistence.models);
  process.stdout.write(
    `${JSON.stringify(
      {
        action,
        sourceSha256: curriculum.sourceSha256,
        ...report
      },
      null,
      2
    )}\n`
  );
  if (!report.valid) process.exitCode = 1;
} finally {
  await closePersistence(persistence);
}
