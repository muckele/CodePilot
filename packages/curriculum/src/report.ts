import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { runCurriculumPreflight, type CurriculumPreflightReport } from "./preflight.js";
import {
  validateRuntimeCurriculum,
  type RuntimeCurriculumValidationReport
} from "./runtime-validation.js";

export async function writeCurriculumPreflightReport(
  sourcePath: string,
  reportPath: string
): Promise<CurriculumPreflightReport> {
  if (!isAbsolute(reportPath)) {
    throw new TypeError("Curriculum preflight report path must be absolute.");
  }

  const report = await runCurriculumPreflight(sourcePath);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export async function writeRuntimeCurriculumValidationReport(
  sourcePath: string,
  reportPath: string
): Promise<RuntimeCurriculumValidationReport> {
  if (!isAbsolute(reportPath)) {
    throw new TypeError("Curriculum validation report path must be absolute.");
  }

  const report = await validateRuntimeCurriculum(sourcePath);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}
