import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_LIMITS } from "@codelift/config";

export type ApiEnvironment = "development" | "test" | "production";
export type PersistenceMode = "optional" | "required";
export type RegistrationMode = "closed" | "invite_only" | "open";

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

export interface RegistrationConfig {
  readonly mode: RegistrationMode;
  readonly invitationTtlMs: number;
  readonly passwordResetTtlMs: number;
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
  readonly registration: RegistrationConfig;
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

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

function parseWebOrigin(value: string | undefined, nodeEnv: ApiEnvironment): string {
  if (nodeEnv === "production" && (value === undefined || value.trim() === "")) {
    throw new Error("WEB_ORIGIN is required in production and must be the exact HTTPS origin.");
  }

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

  if (nodeEnv === "production" && parsed.protocol !== "https:") {
    throw new Error("WEB_ORIGIN must use HTTPS in production.");
  }

  if (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname)) {
    throw new Error("HTTP WEB_ORIGIN is permitted only for a loopback development or test host.");
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

function parseRegistrationMode(
  value: string | undefined,
  nodeEnv: ApiEnvironment
): RegistrationMode {
  if (nodeEnv === "test" && value === undefined) {
    throw new Error("REGISTRATION_MODE must be explicit in the test environment.");
  }

  const candidate = value ?? (nodeEnv === "production" ? "invite_only" : "open");
  if (candidate !== "closed" && candidate !== "invite_only" && candidate !== "open") {
    throw new Error("REGISTRATION_MODE must be closed, invite_only, or open.");
  }

  if (nodeEnv === "production" && candidate === "open") {
    throw new Error(
      "Open production registration requires a future verified email and secure self-service recovery implementation."
    );
  }

  return candidate;
}

function createRegistrationConfig(
  environment: NodeJS.ProcessEnv,
  nodeEnv: ApiEnvironment
): RegistrationConfig {
  return {
    mode: parseRegistrationMode(environment.REGISTRATION_MODE, nodeEnv),
    invitationTtlMs: 7 * 24 * 60 * 60 * 1_000,
    passwordResetTtlMs: 60 * 60 * 1_000
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

function parseTrustProxyHops(value: string | undefined, nodeEnv: ApiEnvironment): number {
  if (nodeEnv === "production" && value === undefined) {
    throw new Error("TRUST_PROXY_HOPS is required in production.");
  }

  return parseBoundedInteger(value, 0, 0, 2, "TRUST_PROXY_HOPS");
}

function optionalSecret(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate === undefined || candidate === "" ? null : candidate;
}

function createAiConfig(environment: NodeJS.ProcessEnv, nodeEnv: ApiEnvironment): AiConfig {
  const config: AiConfig = {
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

  if (config.provider === "openai") {
    if (new URL(config.openAiBaseUrl).protocol !== "https:") {
      throw new Error("OPENAI_BASE_URL must use HTTPS when AI_PROVIDER=openai.");
    }
    if (!config.externalEnabled) {
      throw new Error("AI_EXTERNAL_ENABLED must be true when AI_PROVIDER=openai.");
    }
    if (config.openAiModel === null) {
      throw new Error("OPENAI_MODEL is required when AI_PROVIDER=openai.");
    }
    if (config.openAiApiKey === null) {
      throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
    }
  }

  if (nodeEnv === "production") {
    if (config.provider !== "mock") {
      throw new Error("Production private-pilot requires AI_PROVIDER=mock.");
    }
    if (config.externalEnabled) {
      throw new Error("Production private-pilot requires AI_EXTERNAL_ENABLED=false.");
    }
    if (config.agentEnabled) {
      throw new Error("Production private-pilot requires AI_AGENT_ENABLED=false.");
    }
  }

  return config;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = parseEnvironment(environment.NODE_ENV);
  const webOrigin = parseWebOrigin(environment.WEB_ORIGIN, nodeEnv);
  const persistenceMode = parsePersistenceMode(environment.PERSISTENCE_MODE, nodeEnv);
  const mongoUri = parseMongoUri(environment.MONGO_URI);

  if (nodeEnv === "production" && persistenceMode !== "required") {
    throw new Error("PERSISTENCE_MODE must be required in production.");
  }
  if (nodeEnv === "production" && mongoUri === null) {
    throw new Error("MONGO_URI is required in production.");
  }

  return {
    nodeEnv,
    port: parsePort(environment.API_PORT),
    trustProxyHops: parseTrustProxyHops(environment.TRUST_PROXY_HOPS, nodeEnv),
    webOrigin,
    curriculumPath: parseCurriculumPath(environment.CURRICULUM_PATH),
    jsonBodyLimit: HTTP_LIMITS.jsonBody,
    persistence: {
      mode: persistenceMode,
      mongoUri,
      databaseName: parseDatabaseName(environment.MONGO_DB_NAME),
      serverSelectionTimeoutMs: 3_000
    },
    session: createSessionConfig(nodeEnv),
    registration: createRegistrationConfig(environment, nodeEnv),
    ai: createAiConfig(environment, nodeEnv)
  };
}
