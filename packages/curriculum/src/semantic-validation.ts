import { curriculumDayResponseSchema, type CurriculumDayResponse } from "@codelift/contracts";

import type { RuntimeCurriculumFailure } from "./runtime-validation.js";

const observableObjective =
  /^(Build|Create|Explain|Apply|Compare|Trace|Design|Implement|Test|Audit|Model|Use|Practice|Release)\b/u;

const bannedFillerPatterns: readonly RegExp[] = [
  /\blearn more about\b/iu,
  /\buse the (?:relevant|appropriate) section\b/iu,
  /\bread (?:the )?(?:docs|documentation)\b/iu,
  /\bcomplete the bounded artifact\b/iu,
  /\bobservable state transition\b/iu,
  /\bcentral idea behind\b/iu,
  /\bchange one assumption in today(?:'|’)s build task\b/iu,
  /\bwhich failure would reveal the common mistake\b/iu
];

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "before",
  "being",
  "between",
  "build",
  "could",
  "day",
  "does",
  "from",
  "have",
  "into",
  "mission",
  "more",
  "should",
  "that",
  "their",
  "then",
  "this",
  "through",
  "today",
  "using",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your"
]);

type SemanticField = Readonly<{
  path: string;
  value: string;
}>;

export type SemanticValidationMetrics = Readonly<{
  semanticFieldsChecked: number;
  duplicateGroups: number;
  genericFieldFailures: number;
  objectiveAnchorFailures: number;
  commonMistakeAnchorFailures: number;
  topicHintFailures: number;
  knowledgeCheckFailures: number;
}>;

export type SemanticValidationResult = Readonly<{
  failures: readonly RuntimeCurriculumFailure[];
  metrics: SemanticValidationMetrics;
}>;

function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFKD")
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/gu)
      ?.filter((token) => !stopWords.has(token)) ?? []
  );
}

function union(...sets: readonly Set<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

function overlapCount(value: string, anchors: Set<string>): number {
  return [...tokens(value)].filter((token) => anchors.has(token)).length;
}

function normalizedShape(value: string, day: CurriculumDayResponse): string {
  let normalized = value.normalize("NFKD").toLowerCase();
  const replaceValues = [day.title];
  for (const replaceValue of replaceValues) {
    const needle = replaceValue.normalize("NFKD").toLowerCase().trim();
    if (needle.length > 0) normalized = normalized.replaceAll(needle, " <day-specific> ");
  }
  return normalized
    .replace(/\bday\s*\d+\b/gu, " <day-number> ")
    .replace(/\d+/gu, " <number> ")
    .replace(/[^a-z<>]+/gu, " ")
    .replace(/(?:\s*<day-specific>\s*)+/gu, " <day-specific> ")
    .trim();
}

function semanticFields(day: CurriculumDayResponse): readonly SemanticField[] {
  return [
    { path: "learningObjective", value: day.learningObjective },
    { path: "whyItMattersForAIEngineering", value: day.whyItMattersForAIEngineering },
    { path: "mentalModel", value: day.mentalModel },
    { path: "commonMistake", value: day.commonMistake },
    { path: "teachBackPrompt", value: day.teachBackPrompt },
    ...day.resourceLinks.map((resource, index) => ({
      path: `resourceLinks[${index}].topicHint`,
      value: resource.topicHint
    })),
    ...day.knowledgeChecks.flatMap((check, index) => [
      { path: `knowledgeChecks[${index}].prompt`, value: check.prompt },
      { path: `knowledgeChecks[${index}].hint`, value: check.hint },
      { path: `knowledgeChecks[${index}].explanation`, value: check.explanation }
    ]),
    ...day.retrievalPrompts.map((value, index) => ({
      path: `retrievalPrompts[${index}]`,
      value
    }))
  ];
}

function failure(
  failures: RuntimeCurriculumFailure[],
  code: string,
  path: string,
  message: string
): void {
  failures.push({ code, path, message });
}

export function validateEnrichedCurriculumDays(
  days: readonly CurriculumDayResponse[]
): SemanticValidationResult {
  const failures: RuntimeCurriculumFailure[] = [];
  const shapes = new Map<string, { dayNumber: number; path: string }[]>();
  let semanticFieldsChecked = 0;
  let genericFieldFailures = 0;
  let objectiveAnchorFailures = 0;
  let commonMistakeAnchorFailures = 0;
  let topicHintFailures = 0;
  let knowledgeCheckFailures = 0;

  days.forEach((candidate, index) => {
    const path = `$.days[${index}]`;
    const parsed = curriculumDayResponseSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        failure(
          failures,
          "RUNTIME_SCHEMA",
          `${path}${issue.path.length === 0 ? "" : `.${issue.path.join(".")}`}`,
          issue.message
        );
      }
      return;
    }
    const day = parsed.data;
    const conceptAnchors = union(
      tokens(day.title),
      tokens(day.corePrinciple),
      tokens(day.skillTags.join(" "))
    );
    const actionAnchors = tokens(day.buildTask);
    const artifactAnchors = tokens(day.tinyArtifact);
    const actionOrArtifactAnchors = union(actionAnchors, artifactAnchors);

    for (const field of semanticFields(day)) {
      semanticFieldsChecked += 1;
      if (field.value.trim().length === 0) {
        failure(
          failures,
          "SEMANTIC_BLANK",
          `${path}.${field.path}`,
          `Day ${day.dayNumber} contains a blank semantic field.`
        );
        genericFieldFailures += 1;
        continue;
      }
      if (bannedFillerPatterns.some((pattern) => pattern.test(field.value))) {
        failure(
          failures,
          "BANNED_FILLER",
          `${path}.${field.path}`,
          `Day ${day.dayNumber} contains generic or banned filler in ${field.path}.`
        );
        genericFieldFailures += 1;
      }
      const shape = `${field.path.replace(/\[\d+\]/gu, "[]")}:${normalizedShape(field.value, day)}`;
      const entries = shapes.get(shape) ?? [];
      entries.push({ dayNumber: day.dayNumber, path: `${path}.${field.path}` });
      shapes.set(shape, entries);
    }

    if (!observableObjective.test(day.learningObjective)) {
      failure(
        failures,
        "LEARNING_OBJECTIVE_VERB",
        `${path}.learningObjective`,
        `Day ${day.dayNumber} learning objective must begin with an observable verb.`
      );
      objectiveAnchorFailures += 1;
    }
    if (
      overlapCount(day.learningObjective, conceptAnchors) < 1 ||
      overlapCount(day.learningObjective, actionOrArtifactAnchors) < 2
    ) {
      failure(
        failures,
        "LEARNING_OBJECTIVE_ANCHORS",
        `${path}.learningObjective`,
        `Day ${day.dayNumber} learning objective must refer to its concept and concrete action or artifact.`
      );
      objectiveAnchorFailures += 1;
    }
    if (
      overlapCount(day.commonMistake, conceptAnchors) < 1 ||
      overlapCount(day.commonMistake, actionOrArtifactAnchors) < 2
    ) {
      failure(
        failures,
        "COMMON_MISTAKE_ANCHORS",
        `${path}.commonMistake`,
        `Day ${day.dayNumber} common mistake must refer to its concept and concrete action or artifact.`
      );
      commonMistakeAnchorFailures += 1;
    }

    day.resourceLinks.forEach((resource, resourceIndex) => {
      if (
        overlapCount(resource.topicHint, union(conceptAnchors, actionOrArtifactAnchors)) < 2 ||
        /\b(?:read (?:the )?(?:docs|documentation)|relevant section|course material|today(?:'|’)s topic)\b/iu.test(
          resource.topicHint
        )
      ) {
        failure(
          failures,
          "GENERIC_TOPIC_HINT",
          `${path}.resourceLinks[${resourceIndex}].topicHint`,
          `Day ${day.dayNumber} resource topic hint must name the day-specific concept, action, or artifact.`
        );
        topicHintFailures += 1;
      }
    });

    const promptShapes = day.knowledgeChecks.map((check) => normalizedShape(check.prompt, day));
    if (new Set(promptShapes).size !== promptShapes.length) {
      failure(
        failures,
        "GENERIC_KNOWLEDGE_CHECK",
        `${path}.knowledgeChecks`,
        `Day ${day.dayNumber} knowledge checks must be behaviorally distinct, not title-only variants.`
      );
      knowledgeCheckFailures += 1;
    }
    day.knowledgeChecks.forEach((check, checkIndex) => {
      const combined = `${check.prompt} ${check.hint} ${check.explanation}`;
      if (overlapCount(combined, union(conceptAnchors, actionOrArtifactAnchors)) < 2) {
        failure(
          failures,
          "KNOWLEDGE_CHECK_ANCHORS",
          `${path}.knowledgeChecks[${checkIndex}]`,
          `Day ${day.dayNumber} ${check.kind} check must use day-specific content.`
        );
        knowledgeCheckFailures += 1;
      }
    });
  });

  let duplicateGroups = 0;
  for (const entries of shapes.values()) {
    const uniqueDays = new Set(entries.map((entry) => entry.dayNumber));
    if (uniqueDays.size < 3) continue;
    duplicateGroups += 1;
    for (const entry of entries) {
      failure(
        failures,
        "EXCESSIVE_SEMANTIC_DUPLICATION",
        entry.path,
        `Normalized semantic content is duplicated across ${uniqueDays.size} curriculum days.`
      );
    }
  }

  return {
    failures,
    metrics: {
      semanticFieldsChecked,
      duplicateGroups,
      genericFieldFailures,
      objectiveAnchorFailures,
      commonMistakeAnchorFailures,
      topicHintFailures,
      knowledgeCheckFailures
    }
  };
}
