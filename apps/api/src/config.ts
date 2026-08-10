import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_LIMITS } from "@codelift/config";

export type ApiEnvironment = "development" | "test" | "production";
export type PersistenceMode = "optional" | "required";

export interface PersistenceConfig {
  readonly mode: PersistenceMode;
  readonly mongoUri: string | null;
  readonly databaseName: string;
  readonly serverSelectionTimeoutMs: number;
}

export interface SessionConfig {
  readonly cookieName: string;
  readonly secureCookie: boolean;
  readonly idleTtlMs: number;
  readonly absoluteTtlMs: number;
}

export type AiProvider = "mock" | "python_mock" | "openai" | "local";

export interface AiConfig {
  readonly provider: AiProvider;
  readonly pythonBaseUrl: string;
  readonly localBaseUrl: string;
  readonly openAiBaseUrl: string;
  readonly openAiApiKey: string | null;
  readonly openAiModel: string | null;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly externalEnabled: boolean;
  readonly agentEnabled: boolean;
}

export interface ApiConfig {
  readonly nodeEnv: ApiEnvironment;
  readonly port: number;
  readonly trustProxyHops: number;
  readonly webOrigin: string;
  readonly curriculumPath: string;
  readonly jsonBodyLimit: typeof HTTP_LIMITS.jsonBody;
  readonly persistence: PersistenceConfig;
  readonly session: SessionConfig;
  readonly ai: AiConfig;
}

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const defaultCurriculumPath = resolve(repositoryRoot, "codelift_ai_curriculum_seed_v2_2026.json");

function parseEnvironment(value: string | undefined): ApiEnvironment {
  const environment = value ?? "development";

  if (environment === "development" || environment === "test" || environment === "production") {
    return environment;
  }

  throw new Error("NODE_ENV must be development, test, or production.");
}

function parsePort(value: string | undefined): number {
  const candidate = value ?? "4000";

  if (!/^\d+$/.test(candidate)) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }

  const port = Number(candidate);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function parseWebOrigin(value: string | undefined): string {
  const candidate = value ?? "http://localhost:5173";
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("WEB_ORIGIN must be an absolute HTTP or HTTPS origin.");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("WEB_ORIGIN must be an absolute HTTP or HTTPS origin.");
  }

  return parsed.origin;
}

function parseCurriculumPath(value: string | undefined): string {
  const candidate = value ?? defaultCurriculumPath;
  return isAbsolute(candidate) ? candidate : resolve(repositoryRoot, candidate);
}

function parsePersistenceMode(value: string | undefined, nodeEnv: ApiEnvironment): PersistenceMode {
  const candidate = value ?? (nodeEnv === "production" ? "required" : "optional");

  if (candidate !== "optional" && candidate !== "required") {
    throw new Error("PERSISTENCE_MODE must be optional or required.");
  }

  return candidate;
}

function parseMongoUri(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const candidate = value.trim();

  if (!candidate.startsWith("mongodb://") && !candidate.startsWith("mongodb+srv://")) {
    throw new Error("MONGO_URI must use the mongodb or mongodb+srv scheme.");
  }

  return candidate;
}

function parseDatabaseName(value: string | undefined): string {
  const candidate = value ?? "codelift";

  if (!/^[A-Za-z0-9_-]{1,63}$/.test(candidate)) {
    throw new Error(
      "MONGO_DB_NAME must contain 1 to 63 letters, numbers, underscores, or hyphens."
    );
  }

  return candidate;
}

function createSessionConfig(nodeEnv: ApiEnvironment): SessionConfig {
  const secureCookie = nodeEnv === "production";

  return {
    cookieName: secureCookie ? "__Host-codelift_session" : "codelift_session",
    secureCookie,
    idleTtlMs: 7 * 24 * 60 * 60 * 1000,
    absoluteTtlMs: 30 * 24 * 60 * 60 * 1000
  };
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  const candidate = value ?? String(fallback);
  if (candidate !== "true" && candidate !== "false") {
    throw new Error("Boolean environment values must be true or false.");
  }
  return candidate === "true";
}

function parseAiProvider(value: string | undefined): AiProvider {
  const candidate = value ?? "mock";
  if (
    candidate !== "mock" &&
    candidate !== "python_mock" &&
    candidate !== "openai" &&
    candidate !== "local"
  ) {
    throw new Error("AI_PROVIDER must be mock, python_mock, openai, or local.");
  }
  return candidate;
}

function parseServiceUrl(value: string | undefined, fallback: string, name: string): string {
  const candidate = value ?? fallback;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be an absolute HTTP or HTTPS URL.`);
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error(`${name} must be an absolute HTTP or HTTPS URL.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  const candidate = value ?? String(fallback);
  if (!/^\d+$/.test(candidate)) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

function optionalSecret(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate === undefined || candidate === "" ? null : candidate;
}

function createAiConfig(environment: NodeJS.ProcessEnv): AiConfig {
  return {
    provider: parseAiProvider(environment.AI_PROVIDER),
    pythonBaseUrl: parseServiceUrl(
      environment.AI_PYTHON_BASE_URL,
      "http://127.0.0.1:8000",
      "AI_PYTHON_BASE_URL"
    ),
    localBaseUrl: parseServiceUrl(
      environment.AI_LOCAL_BASE_URL,
      "http://127.0.0.1:11434",
      "AI_LOCAL_BASE_URL"
    ),
    openAiBaseUrl: parseServiceUrl(
      environment.OPENAI_BASE_URL,
      "https://api.openai.com/v1",
      "OPENAI_BASE_URL"
    ),
    openAiApiKey: optionalSecret(environment.OPENAI_API_KEY),
    openAiModel: optionalSecret(environment.OPENAI_MODEL),
    timeoutMs: parseBoundedInteger(environment.AI_TIMEOUT_MS, 8_000, 500, 30_000, "AI_TIMEOUT_MS"),
    maxRetries: parseBoundedInteger(environment.AI_MAX_RETRIES, 1, 0, 2, "AI_MAX_RETRIES"),
    externalEnabled: parseBoolean(environment.AI_EXTERNAL_ENABLED),
    agentEnabled: parseBoolean(environment.AI_AGENT_ENABLED)
  };
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = parseEnvironment(environment.NODE_ENV);

  return {
    nodeEnv,
    port: parsePort(environment.API_PORT),
    trustProxyHops: parseBoundedInteger(environment.TRUST_PROXY_HOPS, 0, 0, 2, "TRUST_PROXY_HOPS"),
    webOrigin: parseWebOrigin(environment.WEB_ORIGIN),
    curriculumPath: parseCurriculumPath(environment.CURRICULUM_PATH),
    jsonBodyLimit: HTTP_LIMITS.jsonBody,
    persistence: {
      mode: parsePersistenceMode(environment.PERSISTENCE_MODE, nodeEnv),
      mongoUri: parseMongoUri(environment.MONGO_URI),
      databaseName: parseDatabaseName(environment.MONGO_DB_NAME),
      serverSelectionTimeoutMs: 3_000
    },
    session: createSessionConfig(nodeEnv),
    ai: createAiConfig(environment)
  };
}
