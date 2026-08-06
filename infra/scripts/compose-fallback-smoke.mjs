import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const composeFile = path.join(root, "infra", "compose.yaml");
const reportPath = path.join(root, "reports", "compose-fallback-smoke.json");
const projectName = `codelift-smoke-${process.pid}`;
const password = "Compose smoke correct horse battery staple!";
const email = `compose-smoke-${process.pid}@example.test`;

function commandOutput(executable, argumentsValue) {
  const result = spawnSync(executable, argumentsValue, {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : null;
}

function sourceState() {
  const revision = commandOutput("git", ["rev-parse", "HEAD"]);
  const statusResult = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
    env: process.env
  });
  const status = (statusResult.stdout ?? "").trim();
  return {
    revision,
    statusAvailable: statusResult.status === 0,
    clean: statusResult.status === 0 && status === "",
    changeCount:
      statusResult.status !== 0 ? null : status === "" ? 0 : status.split(/\r?\n/u).length
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a loopback smoke-test port."));
        return;
      }
      const { port } = address;
      server.close((error) => (error === undefined ? resolve(port) : reject(error)));
    });
  });
}

function compose(argumentsValue, environment) {
  const result = spawnSync(
    "docker",
    ["compose", "-p", projectName, "-f", composeFile, ...argumentsValue],
    {
      cwd: root,
      encoding: "utf8",
      env: environment,
      maxBuffer: 20 * 1024 * 1024
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `docker compose ${argumentsValue.join(" ")} failed: ${(result.stderr || result.stdout).slice(-4_000)}`
    );
  }
  return (result.stdout ?? "").trim();
}

async function jsonResponse(response, label) {
  const text = await response.text();
  let decoded;
  try {
    decoded = text.length === 0 ? null : JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON content (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return decoded;
}

const [mongoPort, postgresPort, aiPort, apiPort, webPort] = await Promise.all(
  Array.from({ length: 5 }, () => freePort())
);
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const aiOrigin = `http://127.0.0.1:${aiPort}`;
const environment = {
  ...process.env,
  CODELIFT_MONGO_PORT: String(mongoPort),
  CODELIFT_POSTGRES_PORT: String(postgresPort),
  CODELIFT_AI_PORT: String(aiPort),
  CODELIFT_API_PORT: String(apiPort),
  CODELIFT_WEB_PORT: String(webPort),
  CODELIFT_WEB_ORIGIN: webOrigin
};

const startedAt = new Date();
const sourceAtStart = sourceState();
const sourceRevision = sourceAtStart.revision;
const toolchain = {
  node: process.version,
  nodeExecutable: process.execPath,
  git: commandOutput("git", ["--version"]),
  docker: commandOutput("docker", ["--version"]),
  dockerCompose: commandOutput("docker", ["compose", "version", "--short"])
};
const observations = {
  pythonAvailable: null,
  pythonUnavailableFallback: null,
  apiReadyAfterPythonStop: false,
  webReadyAfterPythonStop: false,
  seedCompleted: false,
  accountDeleted: false
};
const imageBuilds = [];
let cookie = "";
let csrfToken = "";
let failure = null;

function updateCookie(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const candidates = setCookies.length > 0 ? setCookies : [response.headers.get("set-cookie")];
  const sessionCookie = candidates
    .filter((value) => typeof value === "string")
    .map((value) => value.split(";", 1)[0])
    .find((value) => value?.includes("codelift_session="));
  if (sessionCookie !== undefined) cookie = sessionCookie;
}

async function appRequest(pathname, options = {}) {
  const response = await fetch(`${webOrigin}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json, application/problem+json",
      ...(cookie === "" ? {} : { Cookie: cookie }),
      ...(options.method === undefined || options.method === "GET" ? {} : { Origin: webOrigin }),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.csrf === true ? { "X-CSRF-Token": csrfToken } : {})
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  updateCookie(response);
  return response;
}

try {
  for (const service of ["api", "web", "ai"]) {
    compose(["build", service], environment);
    imageBuilds.push(service);
  }
  compose(["--profile", "tools", "build", "seed"], environment);
  imageBuilds.push("seed");
  compose(["up", "-d", "--wait", "--wait-timeout", "300"], environment);
  compose(["--profile", "tools", "run", "--rm", "seed"], environment);
  observations.seedCompleted = true;

  const [webHealth, apiReady, pythonHealth] = await Promise.all([
    fetch(`${webOrigin}/healthz`),
    fetch(`${apiOrigin}/ready`),
    fetch(`${aiOrigin}/health`)
  ]);
  if (!webHealth.ok || !apiReady.ok || !pythonHealth.ok) {
    throw new Error("One or more fresh-volume Compose readiness endpoints failed.");
  }

  const csrf = await jsonResponse(await appRequest("/api/v1/auth/csrf"), "CSRF bootstrap");
  csrfToken = csrf.csrfToken;
  const registered = await jsonResponse(
    await appRequest("/api/v1/auth/register", {
      method: "POST",
      csrf: true,
      body: { email, password }
    }),
    "registration"
  );
  csrfToken = registered.csrfToken;
  await jsonResponse(
    await appRequest("/api/v1/me/onboarding", {
      method: "PUT",
      csrf: true,
      body: {
        displayName: "Compose Smoke",
        timezone: "America/Los_Angeles",
        startDate: "2026-08-03",
        commitmentMinutes: 30,
        preferredCodingTime: "20:30",
        routineCue: "the smoke test begins",
        codingPlace: "the isolated Compose project",
        implementationIntention:
          "At 20:30, after the smoke test begins, I will code in the isolated Compose project for 30 minutes.",
        whyItMatters: "This verifies the documented no-key deployment path.",
        githubUsername: "",
        targetRoles: ["Full-Stack AI Application Engineer"],
        aiPrivacyMode: "local_only",
        themePreference: "system",
        motionPreference: "gentle",
        reviewPreference: "before_mission"
      }
    }),
    "onboarding"
  );

  const pythonCoach = await jsonResponse(
    await appRequest("/api/v1/coach/explain", {
      method: "POST",
      csrf: true,
      body: {
        action: "explain",
        dayNumber: 1,
        learnerText: "Explain the first mission boundary.",
        allowExternal: false
      }
    }),
    "Python-available coach"
  );
  if (pythonCoach.provider !== "python_mock") {
    throw new Error(
      `Expected python_mock before stopping Python; received ${pythonCoach.provider}.`
    );
  }
  observations.pythonAvailable = {
    provider: pythonCoach.provider,
    generated: pythonCoach.generated
  };

  compose(["stop", "ai"], environment);
  const [apiAfterStop, webAfterStop] = await Promise.all([
    fetch(`${apiOrigin}/ready`),
    fetch(`${webOrigin}/healthz`)
  ]);
  observations.apiReadyAfterPythonStop = apiAfterStop.ok;
  observations.webReadyAfterPythonStop = webAfterStop.ok;
  if (!apiAfterStop.ok || !webAfterStop.ok) {
    throw new Error("API or web readiness failed after the Python service stopped.");
  }

  const fallbackCoach = await jsonResponse(
    await appRequest("/api/v1/coach/explain", {
      method: "POST",
      csrf: true,
      body: {
        action: "explain",
        dayNumber: 1,
        learnerText: "Explain the first mission boundary after Python stops.",
        allowExternal: false
      }
    }),
    "Python-unavailable coach"
  );
  if (fallbackCoach.provider !== "fallback") {
    throw new Error(`Expected deterministic fallback; received ${fallbackCoach.provider}.`);
  }
  observations.pythonUnavailableFallback = {
    provider: fallbackCoach.provider,
    generated: fallbackCoach.generated
  };

  const deletion = await appRequest("/api/v1/me", {
    method: "DELETE",
    csrf: true,
    body: { password, confirmation: "DELETE" }
  });
  if (deletion.status !== 204) {
    throw new Error(`Smoke-account deletion returned HTTP ${deletion.status}.`);
  }
  observations.accountDeleted = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    compose(["down", "--volumes", "--remove-orphans"], environment);
  } catch (cleanupError) {
    const cleanupMessage =
      cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    failure = failure === null ? cleanupMessage : `${failure}; cleanup failed: ${cleanupMessage}`;
  }
}

const sourceAtEnd = sourceState();
const sourceClean = sourceAtStart.clean && sourceAtEnd.clean;
const revisionStable = sourceRevision !== null && sourceAtEnd.revision === sourceRevision;
const revisionBound = sourceRevision !== null && sourceClean && revisionStable;

const report = {
  generatedAt: new Date().toISOString(),
  startedAt: startedAt.toISOString(),
  profile: "fresh-volume-python-available-and-fallback-smoke",
  sourceRevision,
  sourceClean,
  revisionBound,
  sourceState: {
    atStart: sourceAtStart,
    atEnd: sourceAtEnd,
    revisionStable
  },
  toolchain,
  projectName,
  imageBuilds,
  observations,
  failure,
  passed:
    failure === null &&
    observations.seedCompleted &&
    observations.pythonAvailable?.provider === "python_mock" &&
    observations.pythonUnavailableFallback?.provider === "fallback" &&
    observations.apiReadyAfterPythonStop &&
    observations.webReadyAfterPythonStop &&
    observations.accountDeleted
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
