import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const root = process.cwd();

function run(executable, argumentsValue, environment = process.env) {
  const result = spawnSync(executable, argumentsValue, {
    cwd: root,
    encoding: "utf8",
    env: environment,
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${executable} ${argumentsValue.join(" ")} failed.`);
  }
}

const requiredMarkers = [
  [
    "apps/api/src/config.ts",
    [
      "invite_only",
      "WEB_ORIGIN must use HTTPS",
      "MONGO_URI is required",
      "EMAIL_PROVIDER=fake is forbidden in production",
      "RESEND_API_KEY_FILE",
      "EMAIL_LOGIN_CODE_PEPPER_FILE"
    ]
  ],
  [
    "apps/api/src/account/service.ts",
    ["resetPassword", "exportAccount", "Invitation.findOneAndUpdate"]
  ],
  [
    "apps/web/nginx.conf",
    [
      "Content-Security-Policy",
      "immutable",
      "gzip on",
      "access_log off",
      'Referrer-Policy "no-referrer"',
      "log_format codelift_privacy"
    ]
  ],
  [
    "infra/compose.production.yaml",
    [
      "REGISTRATION_MODE: invite_only",
      "TRUST_PROXY_HOPS:",
      "AI_PROVIDER: mock",
      "MONGO_URI_FILE:",
      "RESEND_API_KEY_FILE:",
      "EMAIL_LOGIN_CODE_PEPPER_FILE:"
    ]
  ],
  [
    "docs/adr/0009-self-service-account-access.md",
    ["delivery acknowledgement", "runtime outage", "opaque idempotency", "operator setup"]
  ],
  [
    "docs/milestones/17-self-service-account-access.md",
    ["v0.1.1", "password login", "Email me a sign-in code", "Forgot password"]
  ],
  ["services/ai/Dockerfile", ["uv sync --locked", "USER 65532:65532"]],
  ["docs/mvp-pilot.md", ["Private-pilot hypothesis", "Stop criteria"]]
];
for (const [file, markers] of requiredMarkers) {
  const content = await readFile(file, "utf8");
  for (const marker of markers) {
    if (!content.includes(marker)) throw new Error(`${file} is missing required marker: ${marker}`);
  }
}

const nginxConfiguration = await readFile("apps/web/nginx.conf", "utf8");
const privacyLogFormat = /log_format\s+codelift_privacy\s+([\s\S]*?);/u.exec(
  nginxConfiguration
)?.[1];
if (privacyLogFormat === undefined) {
  throw new Error("apps/web/nginx.conf must define the codelift_privacy log format.");
}
const allowedLogVariables = new Set([
  "$remote_addr",
  "$remote_user",
  "$time_local",
  "$request_method",
  "$uri",
  "$server_protocol",
  "$status",
  "$body_bytes_sent"
]);
const configuredLogVariables = privacyLogFormat.match(/\$[A-Za-z0-9_]+/gu) ?? [];
if (configuredLogVariables.some((variable) => !allowedLogVariables.has(variable))) {
  throw new Error(
    "apps/web/nginx.conf codelift_privacy logs must use only bounded non-query fields."
  );
}

run("git", [
  "diff",
  "--quiet",
  "424de51004e08e7e6b115b72e61519c35388f040",
  "--",
  "codelift_ai_codex_master_prompt_v2_2026.md",
  "codelift_ai_curriculum_seed_v2_2026.json"
]);
run("docker", ["compose", "-f", "infra/compose.production.yaml", "config", "--quiet"], {
  ...process.env,
  CODELIFT_API_IMAGE: "example.invalid/codelift-api@sha256:" + "a".repeat(64),
  CODELIFT_WEB_IMAGE: "example.invalid/codelift-web@sha256:" + "b".repeat(64),
  CODELIFT_AI_IMAGE: "example.invalid/codelift-ai@sha256:" + "c".repeat(64),
  WEB_ORIGIN: "https://pilot.example.test",
  TRUST_PROXY_HOPS: "1",
  MONGO_URI_SECRET_FILE: "/dev/null",
  EMAIL_PROVIDER: "disabled"
});

for (const manifest of [
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/config/package.json",
  "packages/contracts/package.json",
  "packages/curriculum/package.json",
  "packages/evals/package.json",
  "packages/ui/package.json"
]) {
  const parsed = JSON.parse(await readFile(manifest, "utf8"));
  if (parsed.version !== "0.1.1")
    throw new Error(`${manifest} must declare release version 0.1.1.`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      passed: true,
      scope: "source-only",
      hostedClaims: false,
      checks: requiredMarkers.map(([file]) => file)
    },
    null,
    2
  )}\n`
);
