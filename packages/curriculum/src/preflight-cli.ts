import { fileURLToPath } from "node:url";

import { writeCurriculumPreflightReport } from "./report.js";

const defaultSourcePath = fileURLToPath(
  new URL("../../../codelift_ai_curriculum_seed_v2_2026.json", import.meta.url)
);
const defaultReportPath = fileURLToPath(
  new URL("../../../reports/curriculum-preflight.json", import.meta.url)
);

async function main(): Promise<void> {
  const [sourceArgument, reportArgument, unexpectedArgument] = process.argv.slice(2);
  if (unexpectedArgument !== undefined) {
    throw new TypeError("Usage: preflight [absolute-source-path] [absolute-report-path]");
  }
  const reportPath = reportArgument ?? defaultReportPath;
  const report = await writeCurriculumPreflightReport(
    sourceArgument ?? defaultSourcePath,
    reportPath
  );
  process.stdout.write(
    `${JSON.stringify({
      valid: report.valid,
      validationProfile: report.validationProfile,
      displayReady: report.displayReady,
      sourceSha256: report.sourceSha256,
      dayCount: report.counts.days,
      failureCount: report.failures.length,
      reportPath
    })}\n`
  );
  if (!report.valid) process.exitCode = 1;
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown preflight error.";
  process.stderr.write(`${JSON.stringify({ valid: false, error: message })}\n`);
  process.exitCode = 1;
}
