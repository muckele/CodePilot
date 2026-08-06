import { createHash } from "node:crypto";

import type { CoachRequest, CurriculumDayResponse, ProviderCapability } from "@codelift/contracts";
import { z } from "zod";

import type { AiConfig } from "../config.js";

export const coachPayloadSchema = z
  .object({
    heading: z.string().trim().min(1).max(240),
    explanation: z.string().trim().min(1).max(4_000),
    socraticQuestion: z.string().trim().min(1).max(1_000),
    nextTinyStep: z.string().trim().min(1).max(1_000),
    evidenceBoundary: z.string().trim().min(1).max(1_000),
    safetyNote: z.string().trim().min(1).max(1_000)
  })
  .strict();

export type CoachPayload = z.infer<typeof coachPayloadSchema>;

export interface CoachContext {
  readonly request: CoachRequest;
  readonly day: CurriculumDayResponse;
  readonly permitExternal: boolean;
  readonly forceMock?: boolean;
}

export interface CoachGeneration {
  readonly provider: "mock" | "python_mock" | "openai" | "local" | "fallback";
  readonly payload: CoachPayload;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
  readonly outcome: "success" | "fallback" | "refused" | "error";
  readonly failureKind:
    "none" | "permission_denied" | "refusal" | "timeout" | "malformed_output" | "provider_error";
  readonly detail: string;
}

export type ProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

interface Provider {
  readonly name: CoachGeneration["provider"];
  generate(context: CoachContext): Promise<CoachPayload>;
}

const structuredCoachJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    heading: { type: "string" },
    explanation: { type: "string" },
    socraticQuestion: { type: "string" },
    nextTinyStep: { type: "string" },
    evidenceBoundary: { type: "string" },
    safetyNote: { type: "string" }
  },
  required: [
    "heading",
    "explanation",
    "socraticQuestion",
    "nextTinyStep",
    "evidenceBoundary",
    "safetyNote"
  ]
} as const;

function deterministicPayload(context: CoachContext): CoachPayload {
  const learnerBoundary =
    context.request.learnerText.length > 0
      ? "Treat your note as a hypothesis to inspect, not as proof of mastery."
      : "No learner note was supplied, so this stays at the mission boundary.";
  const curriculumQuestion = context.day.knowledgeChecks[2]?.prompt;
  const socraticQuestion =
    context.request.action === "socratic" &&
    curriculumQuestion !== undefined &&
    curriculumQuestion.length >= 20
      ? curriculumQuestion
      : "Which observation would disprove your current explanation, and what would you inspect next?";
  return coachPayloadSchema.parse({
    heading: `Generated guidance for Day ${context.request.dayNumber}`,
    explanation: `${context.day.title} becomes useful when you connect an action to observable evidence. ${context.day.corePrinciple} ${learnerBoundary}`,
    socraticQuestion,
    nextTinyStep: `Make one bounded change toward “${context.day.tinyArtifact}”, then name the check that would prove it.`,
    evidenceBoundary:
      "This generated guidance does not claim understanding. Completion still requires learner-authored evidence and retrieval.",
    safetyNote:
      "CodeLift guidance is educational, not mental-health, employment, or human-worth advice."
  });
}

class MockProvider implements Provider {
  readonly name = "mock";

  async generate(context: CoachContext): Promise<CoachPayload> {
    return deterministicPayload(context);
  }
}

async function fetchJson(
  providerFetch: ProviderFetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<unknown> {
  let lastError: unknown = new Error("Provider request did not run.");
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await providerFetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        const error = new Error(`Provider returned HTTP ${response.status}: ${body}`);
        if (response.status < 500 || attempt === retries) throw error;
        lastError = error;
        continue;
      }
      return await response.json();
    } catch (error: unknown) {
      lastError = error;
      if (attempt === retries) break;
    }
  }
  throw lastError;
}

class PythonMockProvider implements Provider {
  readonly name = "python_mock";

  constructor(
    private readonly config: AiConfig,
    private readonly providerFetch: ProviderFetch
  ) {}

  async generate(context: CoachContext): Promise<CoachPayload> {
    const value = await fetchJson(
      this.providerFetch,
      `${this.config.pythonBaseUrl}/v1/coach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: context.request.action,
          day_number: context.request.dayNumber,
          title: context.day.title,
          principle: context.day.corePrinciple,
          artifact: context.day.tinyArtifact,
          learner_text: context.request.learnerText
        })
      },
      this.config.timeoutMs,
      this.config.maxRetries
    );
    const result = z
      .object({
        provider: z.literal("python_mock"),
        heading: z.string(),
        explanation: z.string(),
        socratic_question: z.string(),
        next_tiny_step: z.string(),
        evidence_boundary: z.string(),
        safety_note: z.string()
      })
      .strict()
      .parse(value);
    return coachPayloadSchema.parse({
      heading: result.heading,
      explanation: result.explanation,
      socraticQuestion: result.socratic_question,
      nextTinyStep: result.next_tiny_step,
      evidenceBoundary: result.evidence_boundary,
      safetyNote: result.safety_note
    });
  }
}

class LocalProvider implements Provider {
  readonly name = "local";

  constructor(
    private readonly config: AiConfig,
    private readonly providerFetch: ProviderFetch
  ) {}

  async generate(context: CoachContext): Promise<CoachPayload> {
    const model = this.config.openAiModel ?? "codelift-local";
    const value = await fetchJson(
      this.providerFetch,
      `${this.config.localBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: structuredCoachJsonSchema,
          prompt: buildCoachPrompt(context)
        })
      },
      this.config.timeoutMs,
      this.config.maxRetries
    );
    const result = z
      .object({ response: z.string().min(1) })
      .passthrough()
      .parse(value);
    return coachPayloadSchema.parse(JSON.parse(result.response));
  }
}

function buildCoachPrompt(context: CoachContext): string {
  return [
    "You are CodeLift's bounded educational coach.",
    "Return only the requested JSON schema.",
    "Do not diagnose health, judge human worth, promise employment, or claim mastery.",
    `Action: ${context.request.action}`,
    `Day ${context.day.dayNumber}: ${context.day.title}`,
    `Objective: ${context.day.learningObjective}`,
    `Principle: ${context.day.corePrinciple}`,
    `Artifact: ${context.day.tinyArtifact}`,
    `Learner note: ${context.request.learnerText || "(none supplied)"}`
  ].join("\n");
}

function extractResponseText(value: unknown): string {
  const parsed = z
    .object({
      output: z.array(
        z
          .object({
            type: z.string(),
            content: z
              .array(
                z
                  .object({
                    type: z.string(),
                    text: z.string().optional(),
                    refusal: z.string().optional()
                  })
                  .passthrough()
              )
              .optional()
          })
          .passthrough()
      )
    })
    .passthrough()
    .parse(value);
  for (const item of parsed.output) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw new Error("The configured provider refused this educational request.");
      }
      if (content.type === "output_text" && content.text !== undefined) {
        return content.text;
      }
    }
  }
  throw new Error("The configured provider returned no structured output.");
}

class OpenAiProvider implements Provider {
  readonly name = "openai";

  constructor(
    private readonly config: AiConfig,
    private readonly providerFetch: ProviderFetch
  ) {}

  async generate(context: CoachContext): Promise<CoachPayload> {
    if (
      !this.config.externalEnabled ||
      !context.permitExternal ||
      this.config.openAiApiKey === null ||
      this.config.openAiModel === null
    ) {
      throw new Error("External generation is not configured and explicitly permitted.");
    }
    const value = await fetchJson(
      this.providerFetch,
      `${this.config.openAiBaseUrl}/responses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openAiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.openAiModel,
          store: false,
          max_output_tokens: 700,
          input: buildCoachPrompt(context),
          text: {
            format: {
              type: "json_schema",
              name: "codelift_coach",
              strict: true,
              schema: structuredCoachJsonSchema
            }
          }
        })
      },
      this.config.timeoutMs,
      this.config.maxRetries
    );
    return coachPayloadSchema.parse(JSON.parse(extractResponseText(value)));
  }
}

function configuredProvider(config: AiConfig, providerFetch: ProviderFetch): Provider {
  if (config.provider === "python_mock") return new PythonMockProvider(config, providerFetch);
  if (config.provider === "openai") return new OpenAiProvider(config, providerFetch);
  if (config.provider === "local") return new LocalProvider(config, providerFetch);
  return new MockProvider();
}

function providerFailureKind(error: unknown): CoachGeneration["failureKind"] {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  if (error instanceof SyntaxError || error instanceof z.ZodError) return "malformed_output";
  if (error instanceof Error) {
    if (/refus/i.test(error.message)) return "refusal";
    if (/explicitly permitted|configured/i.test(error.message)) return "permission_denied";
    if (/timeout|timed out/i.test(error.message)) return "timeout";
  }
  return "provider_error";
}

export class AiGateway {
  readonly #primary: Provider;
  readonly #fallback = new MockProvider();

  constructor(
    private readonly config: AiConfig,
    dependencies: { providerFetch?: ProviderFetch } = {}
  ) {
    this.#primary = configuredProvider(config, dependencies.providerFetch ?? fetch);
  }

  capabilities(): ProviderCapability[] {
    return [
      {
        provider: "mock",
        available: true,
        structuredOutput: true,
        tools: false,
        embeddings: true,
        streaming: false,
        local: true,
        privacy: "mock"
      },
      {
        provider: "python_mock",
        available: this.config.provider === "python_mock",
        structuredOutput: true,
        tools: false,
        embeddings: true,
        streaming: false,
        local: true,
        privacy: "local"
      },
      {
        provider: "local",
        available: this.config.provider === "local",
        structuredOutput: true,
        tools: false,
        embeddings: false,
        streaming: false,
        local: true,
        privacy: "local"
      },
      {
        provider: "openai",
        available:
          this.config.provider === "openai" &&
          this.config.externalEnabled &&
          this.config.openAiApiKey !== null &&
          this.config.openAiModel !== null,
        structuredOutput: true,
        tools: true,
        embeddings: false,
        streaming: true,
        local: false,
        privacy: "external_opt_in"
      }
    ];
  }

  async coach(context: CoachContext): Promise<CoachGeneration> {
    const startedAt = performance.now();
    if (context.forceMock === true) {
      return {
        provider: "mock",
        payload: await this.#fallback.generate(context),
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        estimatedCostUsd: 0,
        outcome: "fallback",
        failureKind: "permission_denied",
        detail: "The AI kill switch forced deterministic mock mode."
      };
    }
    try {
      const payload = await this.#primary.generate(context);
      return {
        provider: this.#primary.name,
        payload,
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        estimatedCostUsd: 0,
        outcome: "success",
        failureKind: "none",
        detail: "Configured provider completed with validated structured output."
      };
    } catch (error: unknown) {
      const payload = await this.#fallback.generate(context);
      const failureKind = providerFailureKind(error);
      return {
        provider: "fallback",
        payload,
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        estimatedCostUsd: 0,
        outcome: "fallback",
        failureKind,
        detail:
          error instanceof Error
            ? createHash("sha256").update(error.message).digest("hex").slice(0, 16)
            : "normalized-provider-error"
      };
    }
  }
}
