import { createHash } from "node:crypto";

import {
  evalAssertionResultSchema,
  evalDatasetSchema,
  type EvalAssertionDefinition,
  type EvalAssertionResult,
  type EvalCaseResult,
  type EvalDataset,
  type EvalDatasetCase,
  type EvalScalar
} from "@codelift/contracts";
import { z } from "zod";

export const BEHAVIORAL_EVALUATOR_VERSION = "behavioral-evaluator-v2.0.0";

export type EvalObservation = Readonly<{
  observed: Readonly<Record<string, EvalScalar>>;
  estimatedCostUsd?: number;
}>;

export type EvalScenarioExecutor = (
  scenario: EvalDatasetCase["scenario"],
  caseDefinition: EvalDatasetCase
) => Promise<EvalObservation>;

export type BehavioralEvaluationReport = Readonly<{
  generatedAt: string;
  evaluationProfile: "provider-independent-behavioral-v2";
  evaluatorVersion: string;
  dataset: Readonly<{
    path: string;
    version: string;
    hash: string;
    hashAlgorithm: "sha256";
    name: string;
    caseCount: number;
  }>;
  providerConfig: EvalDataset["providerConfig"] &
    Readonly<{
      datasetHashAlgorithm: "sha256";
      redactionPolicy: "synthetic-fixtures-only";
    }>;
  providerCalls: number;
  externalNetworkCalls: 0;
  modelDownloads: 0;
  estimatedCostUsd: number;
  durationMs: number;
  score: number;
  passingScore: number;
  criticalFailures: readonly string[];
  negativeControlsPassed: boolean;
  passed: boolean;
  cases: readonly EvalCaseResult[];
}>;

export function datasetSha256(rawDataset: string): string {
  return createHash("sha256").update(rawDataset).digest("hex");
}

export function parseEvalDataset(value: unknown): EvalDataset {
  const dataset = evalDatasetSchema.parse(value);
  if (dataset.evaluatorVersion !== BEHAVIORAL_EVALUATOR_VERSION) {
    throw new Error(
      `Dataset evaluatorVersion ${dataset.evaluatorVersion} does not match ${BEHAVIORAL_EVALUATOR_VERSION}.`
    );
  }
  return dataset;
}

function scalarEquals(left: EvalScalar, right: EvalScalar): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function includesScalar(actual: EvalScalar, expected: EvalScalar): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  if (Array.isArray(actual)) {
    return actual.some((entry) => scalarEquals(entry, expected));
  }
  return false;
}

function isUnique(actual: EvalScalar): boolean {
  if (!Array.isArray(actual)) return false;
  return new Set(actual.map((entry) => JSON.stringify(entry))).size === actual.length;
}

export function evaluateAssertion(
  definition: EvalAssertionDefinition,
  observed: Readonly<Record<string, EvalScalar>>
): EvalAssertionResult {
  const fieldPresent = Object.prototype.hasOwnProperty.call(observed, definition.field);
  const actual = fieldPresent ? (observed[definition.field] ?? null) : null;
  let passed = false;
  if (fieldPresent) {
    switch (definition.operator) {
      case "equals":
        passed = scalarEquals(actual, definition.expected);
        break;
      case "not_equals":
        passed = !scalarEquals(actual, definition.expected);
        break;
      case "contains":
      case "includes":
        passed = includesScalar(actual, definition.expected);
        break;
      case "not_contains":
      case "not_includes":
        passed = !includesScalar(actual, definition.expected);
        break;
      case "gte":
        passed =
          typeof actual === "number" &&
          typeof definition.expected === "number" &&
          actual >= definition.expected;
        break;
      case "lte":
        passed =
          typeof actual === "number" &&
          typeof definition.expected === "number" &&
          actual <= definition.expected;
        break;
      case "unique":
        passed = definition.expected === true && isUnique(actual);
        break;
    }
  }
  return evalAssertionResultSchema.parse({
    assertionId: definition.assertionId,
    field: definition.field,
    operator: definition.operator,
    expected: definition.expected,
    actual,
    passed,
    detail: !fieldPresent
      ? `${definition.field} was not present in the observed result.`
      : passed
        ? `${definition.field} satisfied ${definition.operator}.`
        : `${definition.field} did not satisfy ${definition.operator}; expected ${JSON.stringify(
            definition.expected
          )}, observed ${JSON.stringify(actual)}.`
  });
}

export function evaluatorNegativeControlsPass(): boolean {
  const mismatch = evaluateAssertion(
    {
      assertionId: "negative-equality",
      field: "safe",
      operator: "equals",
      expected: true
    },
    { safe: false }
  );
  const duplicate = evaluateAssertion(
    {
      assertionId: "negative-duplicate",
      field: "ids",
      operator: "unique",
      expected: true
    },
    { ids: ["same", "same"] }
  );
  const missingNull = evaluateAssertion(
    {
      assertionId: "negative-missing-field",
      field: "missing",
      operator: "equals",
      expected: null
    },
    {}
  );
  return !mismatch.passed && !duplicate.passed && !missingNull.passed;
}

function normalizeExecutionError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 1_000);
  return "Unknown scenario execution error.";
}

export async function runBehavioralEvaluation(input: {
  dataset: EvalDataset;
  datasetPath: string;
  datasetHash: string;
  execute: EvalScenarioExecutor;
  now?: () => Date;
}): Promise<BehavioralEvaluationReport> {
  const startedAt = performance.now();
  const cases: EvalCaseResult[] = [];

  for (const definition of input.dataset.cases) {
    const caseStartedAt = performance.now();
    let observation: EvalObservation;
    try {
      observation = await input.execute(definition.scenario, definition);
    } catch (error: unknown) {
      observation = {
        observed: {
          executionError: normalizeExecutionError(error)
        },
        estimatedCostUsd: 0
      };
    }
    const assertions = definition.assertions.map((assertion) =>
      evaluateAssertion(assertion, observation.observed)
    );
    const passed = assertions.every((assertion) => assertion.passed);
    cases.push({
      caseId: definition.caseId,
      category: definition.category,
      critical: definition.critical,
      scenarioKind: definition.scenario.kind,
      input: definition.scenario.input,
      expectedBehavior: definition.expectedBehavior,
      expectedAssertions: definition.assertions,
      observed: { ...observation.observed },
      assertions,
      passed,
      detail: passed
        ? `${assertions.length} behavioral assertion${assertions.length === 1 ? "" : "s"} passed.`
        : `${assertions.filter((assertion) => !assertion.passed).length} of ${assertions.length} behavioral assertions failed.`,
      latencyMs: Math.max(0, Math.round(performance.now() - caseStartedAt)),
      estimatedCostUsd: observation.estimatedCostUsd ?? 0
    });
  }

  const criticalFailures = cases
    .filter((entry) => entry.critical && !entry.passed)
    .map((entry) => entry.caseId);
  const negativeControlsPassed = evaluatorNegativeControlsPass();
  const score =
    cases.length === 0 ? 0 : cases.filter((entry) => entry.passed).length / cases.length;
  const estimatedCostUsd = cases.reduce((total, entry) => total + entry.estimatedCostUsd, 0);
  const providerCalls = cases.reduce((total, entry) => {
    const value = entry.observed.outboundCalls;
    return total + (typeof value === "number" ? value : 0);
  }, 0);

  return {
    generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    evaluationProfile: "provider-independent-behavioral-v2",
    evaluatorVersion: BEHAVIORAL_EVALUATOR_VERSION,
    dataset: {
      path: input.datasetPath,
      version: input.dataset.version,
      hash: input.datasetHash,
      hashAlgorithm: "sha256",
      name: input.dataset.name,
      caseCount: input.dataset.cases.length
    },
    providerConfig: {
      ...input.dataset.providerConfig,
      datasetHashAlgorithm: "sha256",
      redactionPolicy: "synthetic-fixtures-only"
    },
    providerCalls,
    externalNetworkCalls: 0,
    modelDownloads: 0,
    estimatedCostUsd,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    score,
    passingScore: input.dataset.passingScore,
    criticalFailures,
    negativeControlsPassed,
    passed:
      score >= input.dataset.passingScore &&
      criticalFailures.length === 0 &&
      negativeControlsPassed,
    cases
  };
}

const plannerUserScopeSchema = z.object({ userId: z.string().min(1) }).strict();
const plannerRoadmapArgsSchema = plannerUserScopeSchema
  .extend({
    fromDayNumber: z.number().int().min(1).max(365),
    limit: z.number().int().min(1).max(14)
  })
  .strict();
const plannerNoteSearchArgsSchema = plannerUserScopeSchema
  .extend({
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(5)
  })
  .strict();
const plannerTimeBudgetArgsSchema = plannerUserScopeSchema
  .extend({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  .strict();

const toolArgumentSchemas: Readonly<Record<string, z.ZodType>> = {
  get_progress: plannerUserScopeSchema,
  get_curriculum_roadmap: plannerRoadmapArgsSchema,
  search_notes: plannerNoteSearchArgsSchema,
  get_time_budget: plannerTimeBudgetArgsSchema
};

export type ToolGuardObservation = Readonly<{
  allowlisted: boolean;
  argumentsValid: boolean;
  authorized: boolean;
  duplicate: boolean;
  stepBudgetOk: boolean;
  tokenBudgetOk: boolean;
  costBudgetOk: boolean;
  wallTimeBudgetOk: boolean;
  budgetWithinLimits: boolean;
  executed: boolean;
  terminalReason: string;
  sideEffectCount: 0;
}>;

export function evaluateToolGuard(input: {
  callId: string;
  toolName: string;
  arguments: Record<string, EvalScalar>;
  allowlistedTools: readonly string[];
  authorized: boolean;
  priorCallIds: readonly string[];
  budget: {
    maxSteps: number;
    stepsUsed: number;
    maxTokens: number;
    tokensUsed: number;
    maxCostUsd: number;
    estimatedCostUsd: number;
    maxWallTimeMs: number;
    wallTimeMs: number;
  };
}): ToolGuardObservation {
  const allowlisted = input.allowlistedTools.includes(input.toolName);
  const schema = toolArgumentSchemas[input.toolName];
  const argumentsValid = schema !== undefined && schema.safeParse(input.arguments).success;
  const duplicate = input.priorCallIds.includes(input.callId);
  const stepBudgetOk = input.budget.stepsUsed < input.budget.maxSteps;
  const tokenBudgetOk = input.budget.tokensUsed <= input.budget.maxTokens;
  const costBudgetOk = input.budget.estimatedCostUsd <= input.budget.maxCostUsd;
  const wallTimeBudgetOk = input.budget.wallTimeMs <= input.budget.maxWallTimeMs;
  const budgetWithinLimits = stepBudgetOk && tokenBudgetOk && costBudgetOk && wallTimeBudgetOk;
  const executed =
    allowlisted && argumentsValid && input.authorized && !duplicate && budgetWithinLimits;
  let terminalReason = "tool_executed";
  if (!allowlisted) terminalReason = "tool_not_allowlisted";
  else if (!argumentsValid) terminalReason = "invalid_tool_arguments";
  else if (!input.authorized) terminalReason = "authorization_denied";
  else if (duplicate) terminalReason = "duplicate_call";
  else if (!budgetWithinLimits) terminalReason = "budget_exhausted";

  return {
    allowlisted,
    argumentsValid,
    authorized: input.authorized,
    duplicate,
    stepBudgetOk,
    tokenBudgetOk,
    costBudgetOk,
    wallTimeBudgetOk,
    budgetWithinLimits,
    executed,
    terminalReason,
    sideEffectCount: 0
  };
}

export function renderUntrustedTextForEvaluation(
  value: string
): Readonly<Record<string, EvalScalar>> {
  const renderedHtml = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  return {
    renderedHtml,
    rawTextPreserved: value,
    executableMarkup:
      /<script\b|<[^>]+\sonerror\s*=|<[^>]+(?:href|src)\s*=\s*["']?javascript:/i.test(renderedHtml),
    renderMode: "text_node"
  };
}
