import { curriculumDayResponseSchema, type CurriculumDayResponse } from "@codelift/contracts";

import { enrichCurriculum } from "./enrichment.js";
import { inspectCurriculumSource } from "./preflight.js";
import {
  validateEnrichedCurriculumDays,
  type SemanticValidationMetrics
} from "./semantic-validation.js";

export type RuntimeCurriculumFailure = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type RuntimeCurriculumValidationReport = Readonly<{
  reportVersion: "2.0.0";
  validationProfile: "runtime";
  displayReady: boolean;
  valid: boolean;
  sourceSha256: string | null;
  counts: Readonly<{
    days: number;
    knowledgeChecks: number;
    resourceLinks: number;
    recoveryMinutesOverLimit: number;
    optionalStretchMinutesOverLimit: number;
  }>;
  semanticValidation: SemanticValidationMetrics;
  failures: readonly RuntimeCurriculumFailure[];
}>;

function validateSemanticDay(
  day: CurriculumDayResponse,
  index: number,
  failures: RuntimeCurriculumFailure[]
): void {
  const path = `$.days[${index}]`;
  const coreMinutes = day.coreSchedule.reduce((total, block) => total + block.minutes, 0);

  if (coreMinutes !== 30) {
    failures.push({
      code: "CORE_MINUTES",
      path: `${path}.coreSchedule`,
      message: `Day ${day.dayNumber} Core schedule totals ${coreMinutes}, not 30.`
    });
  }
  if (day.recoveryMinutes > 5) {
    failures.push({
      code: "RECOVERY_MINUTES",
      path: `${path}.recoveryMinutes`,
      message: `Day ${day.dayNumber} Recovery estimate exceeds five minutes.`
    });
  }
  if (day.optionalStretchMinutes > 10) {
    failures.push({
      code: "STRETCH_MINUTES",
      path: `${path}.optionalStretchMinutes`,
      message: `Day ${day.dayNumber} Stretch estimate exceeds ten minutes.`
    });
  }
  if (day.prerequisiteDayNumbers.some((prerequisite) => prerequisite >= day.dayNumber)) {
    failures.push({
      code: "PREREQUISITE_NOT_PAST",
      path: `${path}.prerequisiteDayNumbers`,
      message: `Day ${day.dayNumber} contains a future or same-day prerequisite.`
    });
  }
}

export async function validateRuntimeCurriculum(
  sourcePath: string
): Promise<RuntimeCurriculumValidationReport> {
  const inspection = await inspectCurriculumSource(sourcePath);
  const failures: RuntimeCurriculumFailure[] = inspection.report.failures.map((failure) => ({
    ...failure
  }));

  if (!inspection.report.valid || inspection.blueprint === undefined) {
    return {
      reportVersion: "2.0.0",
      validationProfile: "runtime",
      displayReady: false,
      valid: false,
      sourceSha256: inspection.report.sourceSha256,
      counts: {
        days: 0,
        knowledgeChecks: 0,
        resourceLinks: 0,
        recoveryMinutesOverLimit: 0,
        optionalStretchMinutesOverLimit: 0
      },
      semanticValidation: {
        semanticFieldsChecked: 0,
        duplicateGroups: 0,
        genericFieldFailures: 0,
        objectiveAnchorFailures: 0,
        commonMistakeAnchorFailures: 0,
        topicHintFailures: 0,
        knowledgeCheckFailures: 0
      },
      failures
    };
  }

  const days = enrichCurriculum(inspection.blueprint);
  days.forEach((day, index) => {
    const parsed = curriculumDayResponseSchema.safeParse(day);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        failures.push({
          code: "RUNTIME_SCHEMA",
          path: `$.days[${index}]${issue.path.length === 0 ? "" : `.${issue.path.join(".")}`}`,
          message: issue.message
        });
      }
      return;
    }
    validateSemanticDay(parsed.data, index, failures);
  });
  const semanticValidation = validateEnrichedCurriculumDays(days);
  failures.push(...semanticValidation.failures);

  if (days.length !== 365) {
    failures.push({
      code: "DAY_COUNT",
      path: "$.days",
      message: `Expected 365 runtime days; received ${days.length}.`
    });
  }
  const finalDay = days[364];
  if (
    finalDay === undefined ||
    finalDay.dayNumber !== 365 ||
    !/release/i.test(finalDay.title) ||
    !/continuation|90-day/i.test(finalDay.portfolioMilestone ?? "")
  ) {
    failures.push({
      code: "FINAL_DAY",
      path: "$.days[364]",
      message: "Day 365 must remain the release, mastery, and continuation day."
    });
  }

  return {
    reportVersion: "2.0.0",
    validationProfile: "runtime",
    displayReady: failures.length === 0,
    valid: failures.length === 0,
    sourceSha256: inspection.report.sourceSha256,
    counts: {
      days: days.length,
      knowledgeChecks: days.reduce((total, day) => total + day.knowledgeChecks.length, 0),
      resourceLinks: days.reduce((total, day) => total + day.resourceLinks.length, 0),
      recoveryMinutesOverLimit: days.filter((day) => day.recoveryMinutes > 5).length,
      optionalStretchMinutesOverLimit: days.filter((day) => day.optionalStretchMinutes > 10).length
    },
    semanticValidation: semanticValidation.metrics,
    failures
  };
}
