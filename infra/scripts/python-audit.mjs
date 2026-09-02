import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const temporary = mkdtempSync(path.join(os.tmpdir(), "codelift-python-audit-"));
const requirements = path.join(temporary, "locked-requirements.txt");
const cache = path.join(temporary, "cache");

function run(label, executable, argumentsValue, cwd = root) {
  const result = spawnSync(executable, argumentsValue, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, UV_CACHE_DIR: path.join(temporary, "uv-cache") },
    maxBuffer: 10 * 1024 * 1024
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

run("locked dependency export", path.join(root, "services/ai/.venv/bin/uv"), [
  "export",
  "--project",
  "services/ai",
  "--locked",
  "--extra",
  "dev",
  "--no-emit-project",
  "--output-file",
  requirements
]);
run("Python vulnerability audit", path.join(root, "services/ai/.venv/bin/pip-audit"), [
  "--cache-dir",
  cache,
  "--progress-spinner",
  "off",
  "--strict",
  "--requirement",
  requirements
]);
process.stdout.write("Locked Python dependency audit passed.\n");
