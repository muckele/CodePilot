import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { runLocalBehavioralEvaluation } from "../../apps/api/src/ai/local-eval.js";

const root = process.cwd();
const reportPath = path.join(root, "reports", "local-ai-eval.json");
const report = await runLocalBehavioralEvaluation();

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
