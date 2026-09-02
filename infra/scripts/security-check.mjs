import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const reportPath = path.join(root, "reports", "security.json");
const ignoredDirectories = new Set([
  ".git",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "reports",
  "test-results"
]);
const ignoredFiles = new Set([
  "codelift_ai_codex_master_prompt_v2_2026.md",
  "codelift_ai_curriculum_seed_v2_2026.json",
  "pnpm-lock.yaml"
]);
const scannedExtensions = new Set([
  ".env",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".py",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml"
]);
const findings = [];
const sourceFiles = [];

function stripSourceComments(content, file) {
  if (path.basename(file) === "Dockerfile") {
    return content.replace(/^[\t ]*#.*$/gmu, "");
  }

  let output = "";
  let state = "code";
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (state === "line-comment") {
      if (character === "\n") {
        output += character;
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state !== "code") {
      output += character;
      if (character === "\\" && nextCharacter !== undefined) {
        output += nextCharacter;
        index += 1;
        continue;
      }
      if (
        (state === "single-quoted" && character === "'") ||
        (state === "double-quoted" && character === '"') ||
        (state === "template" && character === "`")
      ) {
        state = "code";
      }
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && nextCharacter === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else {
      output += character;
      if (character === "'") state = "single-quoted";
      if (character === '"') state = "double-quoted";
      if (character === "`") state = "template";
    }
  }
  return output;
}

const sourceCommentNegativeControl = stripSourceComments(
  [
    "// tokenHash csrfHash humanApproved",
    'const url = "https://example.com/resource";',
    "/* authenticateMutation */",
    "const liveControl = persistCheckpoint;"
  ].join("\n"),
  "negative-control.ts"
);
const dockerCommentNegativeControl = stripSourceComments(
  "# USER node\nRUN node --version\n",
  "Dockerfile"
);
const scannerNegativeControlsPassed =
  !sourceCommentNegativeControl.includes("tokenHash") &&
  !sourceCommentNegativeControl.includes("authenticateMutation") &&
  sourceCommentNegativeControl.includes("https://example.com/resource") &&
  sourceCommentNegativeControl.includes("persistCheckpoint") &&
  !dockerCommentNegativeControl.includes("USER node") &&
  dockerCommentNegativeControl.includes("RUN node --version");

if (!scannerNegativeControlsPassed) {
  findings.push({
    severity: "critical",
    code: "STATIC_SCANNER_NEGATIVE_CONTROL_FAILED",
    file: "infra/scripts/security-check.mjs"
  });
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath);
      continue;
    }
    if (
      ignoredFiles.has(entry.name) ||
      (!scannedExtensions.has(path.extname(entry.name)) && entry.name !== ".env.example")
    ) {
      continue;
    }
    sourceFiles.push(absolutePath);
  }
}

await walk(root);

for (const file of sourceFiles) {
  const relativePath = path.relative(root, file);
  const content = await readFile(file, "utf8");
  const secretPatterns = [
    { code: "OPENAI_STYLE_SECRET", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
    {
      code: "ASSIGNED_PROVIDER_SECRET",
      pattern:
        /\b(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|MISTRAL|COHERE)_API_KEY[ \t]*=[ \t]*["']?[^"'\s#]{8,}/g
    },
    {
      code: "PRIVATE_KEY",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
    }
  ];
  for (const { code, pattern } of secretPatterns) {
    if (pattern.test(content)) {
      findings.push({ severity: "critical", code, file: relativePath });
    }
  }

  if (relativePath.startsWith(`apps${path.sep}web${path.sep}src${path.sep}`)) {
    if (content.includes("codelift_ai_curriculum_seed_v2_2026.json")) {
      findings.push({
        severity: "critical",
        code: "CLIENT_IMPORTS_CANONICAL_SEED",
        file: relativePath
      });
    }
    if (content.includes("dangerouslySetInnerHTML")) {
      findings.push({
        severity: "critical",
        code: "UNSAFE_REACT_HTML_ESCAPE_HATCH",
        file: relativePath
      });
    }
    if (/\bfetch\(\s*["']https?:\/\//u.test(content)) {
      findings.push({
        severity: "critical",
        code: "BROWSER_BYPASSES_NODE_POLICY_BOUNDARY",
        file: relativePath
      });
    }
  }
}

const requiredControls = [
  {
    name: "Argon2id password hashing",
    file: "apps/api/src/account/security.ts",
    markers: ["argon2id", "hashPassword"]
  },
  {
    name: "hashed opaque sessions and CSRF",
    file: "apps/api/src/account/service.ts",
    markers: ["tokenHash", "csrfHash"]
  },
  {
    name: "hashed single-use invitation and recovery tokens",
    file: "apps/api/src/account/service.ts",
    markers: ["Invitation.findOneAndUpdate", "PasswordReset.findOneAndUpdate", "digestOpaqueToken"]
  },
  {
    name: "versioned secret-free account export",
    file: "packages/contracts/src/account.ts",
    markers: ["codelift.account-export.v1", "containsForbiddenExportKey"]
  },
  {
    name: "exact-origin mutation authorization",
    file: "apps/api/src/account/router.ts",
    markers: ["authenticateMutation"]
  },
  {
    name: "tenant-scoped indexed-source retrieval",
    file: "apps/api/src/learning/service.ts",
    markers: ["IndexedSource.find({ userId })", "IndexedSource.findOne({", "_id: request.sourceId"]
  },
  {
    name: "provider timeout and fallback",
    file: "apps/api/src/ai/providers.ts",
    markers: ["AbortSignal.timeout", "fallback.generate", "store: false"]
  },
  {
    name: "runtime-validated approval-gated planner graph",
    file: "apps/api/src/learning/planner-graph.ts",
    markers: [
      "parsePlannerGraphState",
      "PlannerToolRegistry",
      "humanApproved",
      "persistCheckpoint",
      'return terminal(state, "failed", "budget_exhausted"',
      "isKillSwitchActive",
      'state.approvalBehavior === "proposal_only"'
    ]
  },
  {
    name: "required Mongo indexes are initialized",
    file: "apps/api/src/persistence/runtime.ts",
    markers: ["autoIndex: false", "model.createIndexes()"]
  },
  {
    name: "account deletion cascade",
    file: "apps/api/src/account/service.ts",
    markers: ["IndexedSource.deleteMany", "JobApplication.deleteMany", "Session.deleteMany"]
  },
  {
    name: "non-root API container",
    file: "apps/api/Dockerfile",
    markers: ["USER node"]
  },
  {
    name: "non-root Python container",
    file: "services/ai/Dockerfile",
    markers: ["USER 65532:65532"]
  },
  {
    name: "non-root web container and explicit CSP",
    file: "apps/web/nginx.conf",
    markers: ["Content-Security-Policy", "frame-ancestors 'none'", "immutable"]
  }
];

const controlResults = [];
for (const control of requiredControls) {
  try {
    const content = await readFile(path.join(root, control.file), "utf8");
    const structuralContent = stripSourceComments(content, control.file);
    const missing = control.markers.filter((marker) => !structuralContent.includes(marker));
    controlResults.push({
      ...control,
      evidenceKind: "comment-stripped-structural-marker",
      structuralMarkersPresent: missing.length === 0,
      passed: missing.length === 0,
      missing
    });
    if (missing.length > 0) {
      findings.push({
        severity: "critical",
        code: "REQUIRED_SECURITY_CONTROL_MISSING",
        file: control.file,
        control: control.name,
        missing
      });
    }
  } catch {
    findings.push({
      severity: "critical",
      code: "REQUIRED_SECURITY_FILE_MISSING",
      file: control.file,
      control: control.name
    });
  }
}

const webManifest = JSON.parse(
  await readFile(path.join(root, "apps", "web", "package.json"), "utf8")
);
for (const dependency of Object.keys({
  ...(webManifest.dependencies ?? {}),
  ...(webManifest.devDependencies ?? {})
}).filter((name) => ["openai", "@anthropic-ai/sdk", "@google/generative-ai"].includes(name))) {
  findings.push({
    severity: "critical",
    code: "PROVIDER_SDK_IN_BROWSER_PACKAGE",
    file: "apps/web/package.json",
    dependency
  });
}

const criticalFindings = findings.filter((finding) => finding.severity === "critical");
const report = {
  generatedAt: new Date().toISOString(),
  profile: "static-structural-security-evidence",
  evidenceKind: "static_source_structure_not_behavioral_proof",
  evidenceBoundary:
    "This scan detects secrets and expected source structure. It does not prove runtime authorization, isolation, or attack resistance; the release gate separately requires integration and end-to-end behavioral tests.",
  behavioralCompanionGates: ["test:integration", "test:e2e"],
  scannerNegativeControlsPassed,
  threatClasses: [
    "auth/session/CSRF/XSS/injection",
    "broken object authorization",
    "secret and log leakage",
    "prompt injection and poisoned retrieval",
    "improper model output handling",
    "excessive agency and denial of wallet",
    "cross-tenant vector leakage",
    "deletion and retention failure",
    "provider and container supply chain"
  ],
  scannedFiles: sourceFiles.length,
  controls: controlResults,
  findings,
  criticalFailures: criticalFindings.length,
  passed: criticalFindings.length === 0
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
