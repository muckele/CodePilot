import { spawnSync } from "node:child_process";

const root = process.cwd();
const images = [
  {
    name: "api",
    tag: "codelift-mvp-api:audit",
    dockerfile: "apps/api/Dockerfile",
    context: "."
  },
  {
    name: "web",
    tag: "codelift-mvp-web:audit",
    dockerfile: "apps/web/Dockerfile",
    context: "."
  },
  {
    name: "ai",
    tag: "codelift-mvp-ai:audit",
    dockerfile: "services/ai/Dockerfile",
    context: "services/ai"
  }
];

function run(executable, argumentsValue) {
  const result = spawnSync(executable, argumentsValue, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${argumentsValue.join(" ")} failed with exit code ${result.status}.`
    );
  }
}

function assertRuntimeShape(image) {
  if (image.name === "api") {
    run("docker", [
      "run",
      "--rm",
      "--entrypoint",
      "node",
      image.tag,
      "-e",
      "const fs=require('node:fs'); if(process.getuid?.()===0)throw Error('root runtime'); for(const f of ['apps/api/dist/server.js','codelift_ai_curriculum_seed_v2_2026.json','evals/datasets/local-safety-v1.json'])if(!fs.existsSync(f))throw Error('missing '+f); try{require.resolve('vitest');throw Error('vitest present')}catch(e){if(e.message==='vitest present')throw e;}"
    ]);
    return;
  }
  if (image.name === "web") {
    run("docker", [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      image.tag,
      "-c",
      'test "$(id -u)" -ne 0 && test -f /usr/share/nginx/html/index.html && test -f /etc/nginx/conf.d/default.conf && ! find /usr/share/nginx/html -name "*.map" -print -quit | grep -q .'
    ]);
    return;
  }
  run("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "python",
    image.tag,
    "-c",
    "import importlib.util, os; assert os.getuid() != 0; assert importlib.util.find_spec('app') is not None; assert importlib.util.find_spec('pytest') is None"
  ]);
}

for (const image of images) {
  run("docker", ["build", "--file", image.dockerfile, "--tag", image.tag, image.context]);
  assertRuntimeShape(image);
  run("docker", [
    "run",
    "--rm",
    "-v",
    "/var/run/docker.sock:/var/run/docker.sock",
    "aquasec/trivy:0.67.2",
    "image",
    "--severity",
    "HIGH,CRITICAL",
    "--exit-code",
    "1",
    image.tag
  ]);
}

process.stdout.write("Production image high/critical vulnerability gate passed.\n");
