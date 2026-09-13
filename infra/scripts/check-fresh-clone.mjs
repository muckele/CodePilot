import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { createFreshCloneEnvironment } from "./fresh-clone-environment.mjs";
import { fullSourceStatusArguments } from "./release-source-state.mjs";

const root = process.cwd();
const reportPath = path.join(root, "reports", "fresh-clone.json");
const startedAt = new Date();
const pnpmCli = process.env.npm_execpath;
const pythonExecutable = process.env.CODELIFT_PYTHON_BIN ?? "python3.12";
const commandResults = [];
let cloneDirectory = null;
let failure = null;
let cloneComposeEvidence = null;
let pnpmVersion = null;
let pythonVersion = null;
let uvCacheDirectory = null;

function run(label, executable, argumentsValue, options = {}) {
  const commandStartedAt = Date.now();
  const result = spawnSync(executable, argumentsValue, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 20 * 1024 * 1024
  });
  const record = {
    label,
    command: [executable, ...argumentsValue].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - commandStartedAt,
    stdoutTail: (result.stdout ?? "").slice(-2_000),
    stderrTail: (result.stderr ?? "").slice(-2_000)
  };
  commandResults.push(record);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status)}.`);
  }
  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  return options.useStderrWhenStdoutEmpty === true && stdout === "" ? stderr : stdout;
}

function pnpm(label, argumentsValue, cwd, environment) {
  if (pnpmCli === undefined || pnpmCli.trim() === "") {
    throw new Error("npm_execpath is required so the fresh-clone check reuses pinned pnpm.");
  }
  return run(label, process.execPath, [pnpmCli, ...argumentsValue], {
    cwd,
    env: environment
  });
}

function parsePython312Version(versionOutput) {
  const match = /^Python\s+(\d+)\.(\d+)\.(\d+)([A-Za-z0-9.+-]*)$/u.exec(versionOutput.trim());
  if (match === null) {
    throw new Error(`Could not parse the Python version from ${JSON.stringify(versionOutput)}.`);
  }

  const [, majorText, minorText, patchText, suffix] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);
  if (major !== 3 || minor !== 12) {
    throw new Error(
      `Fresh-clone evidence requires Python 3.12.x; received ${major}.${minor}.${patch}${suffix}.`
    );
  }

  return {
    version: `${major}.${minor}.${patch}${suffix}`,
    major,
    minor,
    patch
  };
}

let sourceRevision = null;
let cloneRevision = null;
let sourceWasClean = false;

try {
  sourceRevision = run("source revision", "git", ["rev-parse", "HEAD"]);
  const status = run("source cleanliness", "git", fullSourceStatusArguments);
  sourceWasClean = status.length === 0;
  if (!sourceWasClean) {
    throw new Error("Fresh-clone evidence requires a clean committed source tree.");
  }

  cloneDirectory = await mkdtemp(path.join(os.tmpdir(), "codelift-fresh-clone-"));
  run("local clone", "git", [
    "clone",
    "--local",
    "--no-hardlinks",
    "--quiet",
    root,
    cloneDirectory
  ]);
  cloneRevision = run("clone revision", "git", ["rev-parse", "HEAD"], {
    cwd: cloneDirectory
  });
  if (cloneRevision !== sourceRevision) {
    throw new Error("The isolated clone revision does not match the release source revision.");
  }

  const cloneEnvironment = createFreshCloneEnvironment(process.env);
  if (pnpmCli === undefined || pnpmCli.trim() === "") {
    throw new Error("npm_execpath is required so the fresh clone uses pinned pnpm.");
  }
  pnpmVersion = run("pnpm version", process.execPath, [pnpmCli, "--version"], {
    cwd: cloneDirectory,
    env: cloneEnvironment
  });
  if (pnpmVersion !== "11.9.0") {
    throw new Error(`Fresh-clone evidence requires pnpm 11.9.0; received ${pnpmVersion}.`);
  }
  run(
    "frozen JavaScript install",
    process.execPath,
    [pnpmCli, "install", "--frozen-lockfile", "--offline"],
    { cwd: cloneDirectory, env: cloneEnvironment }
  );
  const pythonVersionOutput = run("Python version", pythonExecutable, ["--version"], {
    cwd: cloneDirectory,
    env: cloneEnvironment,
    useStderrWhenStdoutEmpty: true
  });
  pythonVersion = parsePython312Version(pythonVersionOutput);
  run("Python virtual environment", pythonExecutable, ["-m", "venv", "services/ai/.venv"], {
    cwd: cloneDirectory,
    env: cloneEnvironment
  });
  run(
    "Pinned uv install",
    path.join(cloneDirectory, "services", "ai", ".venv", "bin", "pip"),
    ["install", "--disable-pip-version-check", "--no-input", "uv==0.12.3"],
    { cwd: cloneDirectory, env: cloneEnvironment }
  );
  uvCacheDirectory = await mkdtemp(path.join(os.tmpdir(), "codelift-fresh-uv-"));
  run(
    "Locked Python development sync",
    path.join(cloneDirectory, "services", "ai", ".venv", "bin", "uv"),
    ["sync", "--project", "services/ai", "--locked", "--extra", "dev"],
    {
      cwd: cloneDirectory,
      env: { ...cloneEnvironment, UV_CACHE_DIR: uvCacheDirectory }
    }
  );
  pnpm("production build", ["build"], cloneDirectory, cloneEnvironment);
  pnpm("unit and service tests", ["test"], cloneDirectory, cloneEnvironment);
  pnpm("curriculum validation", ["curriculum:validate"], cloneDirectory, cloneEnvironment);
  pnpm("Compose configuration", ["compose:check"], cloneDirectory, cloneEnvironment);
  pnpm(
    "fresh-volume runtime, seed, and fallback smoke",
    ["compose:smoke"],
    cloneDirectory,
    cloneEnvironment
  );
  const composeEvidenceRaw = await readFile(
    path.join(cloneDirectory, "reports", "compose-fallback-smoke.json"),
    "utf8"
  );
  cloneComposeEvidence = JSON.parse(composeEvidenceRaw);
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(
    path.join(root, "reports", "compose-fallback-smoke.json"),
    composeEvidenceRaw,
    "utf8"
  );
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (cloneDirectory !== null) {
    await rm(cloneDirectory, { recursive: true, force: true });
  }
  if (uvCacheDirectory !== null) {
    await rm(uvCacheDirectory, { recursive: true, force: true });
  }
}

let packageManager = null;
try {
  packageManager = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8")
  ).packageManager;
} catch {
  // The report records the missing value as an explicit failure below.
}

const report = {
  generatedAt: new Date().toISOString(),
  startedAt: startedAt.toISOString(),
  profile: "clean-local-clone-frozen-javascript-and-locked-python",
  sourceRevision,
  cloneRevision,
  sourceWasClean,
  toolchain: {
    node: process.version,
    nodeExecutable: process.execPath,
    packageManager,
    pnpmCli,
    pnpmVersion,
    pythonExecutable,
    pythonVersion: pythonVersion?.version ?? null,
    requiredPythonSeries: "3.12"
  },
  installPolicy: {
    javascript: "frozen-lockfile-offline",
    python: "uv-lock-on-python-3.12",
    reproducibilityBoundary:
      "clean-source compatibility evidence; JavaScript and Python dependency resolutions are checked in and installed in frozen/locked mode"
  },
  commandResults,
  cloneComposeEvidence:
    cloneComposeEvidence === null
      ? null
      : {
          passed: cloneComposeEvidence.passed,
          sourceRevision: cloneComposeEvidence.sourceRevision,
          sourceClean: cloneComposeEvidence.sourceClean,
          revisionBound: cloneComposeEvidence.revisionBound,
          toolchain: cloneComposeEvidence.toolchain,
          observations: cloneComposeEvidence.observations
        },
  pairedRuntimeEvidence: "reports/compose-fallback-smoke.json",
  failure,
  passed:
    failure === null &&
    sourceWasClean &&
    sourceRevision !== null &&
    cloneRevision === sourceRevision &&
    packageManager === "pnpm@11.9.0" &&
    pnpmVersion === "11.9.0" &&
    process.version === "v24.14.0" &&
    pythonVersion?.major === 3 &&
    pythonVersion?.minor === 12 &&
    cloneComposeEvidence?.passed === true &&
    cloneComposeEvidence?.sourceClean === true &&
    cloneComposeEvidence?.revisionBound === true &&
    cloneComposeEvidence?.sourceRevision === sourceRevision &&
    commandResults.every((entry) => entry.status === "passed")
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
