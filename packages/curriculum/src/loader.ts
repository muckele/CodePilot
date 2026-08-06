import type { CurriculumDayResponse } from "@codelift/contracts";

import { CurriculumSourceError } from "./errors.js";
import {
  createImmutableDayIndex,
  deepFreeze,
  type ReadonlyCurriculumBlueprint
} from "./immutable.js";
import { enrichCurriculum } from "./enrichment.js";
import { inspectCurriculumSource, type CurriculumPreflightReport } from "./preflight.js";
import { validateEnrichedCurriculumDays } from "./semantic-validation.js";

export type RuntimeCurriculumDayIndex = ReadonlyMap<number, CurriculumDayResponse>;

export type LoadedCurriculum = Readonly<{
  blueprint: ReadonlyCurriculumBlueprint;
  index: RuntimeCurriculumDayIndex;
  preflight: CurriculumPreflightReport;
  getDay(dayNumber: number): CurriculumDayResponse | undefined;
}>;

export async function loadCurriculumBlueprint(sourcePath: string): Promise<LoadedCurriculum> {
  const inspection = await inspectCurriculumSource(sourcePath);

  if (!inspection.report.valid || inspection.blueprint === undefined) {
    const unavailable = inspection.report.failures.some(
      (failure) => failure.code === "SOURCE_READ"
    );
    throw new CurriculumSourceError(
      unavailable ? "CURRICULUM_SOURCE_UNAVAILABLE" : "CURRICULUM_SOURCE_INVALID",
      unavailable
        ? "Curriculum source is unavailable."
        : "Curriculum source failed blueprint preflight.",
      inspection.report
    );
  }

  const enrichedDays = enrichCurriculum(inspection.blueprint);
  const semanticValidation = validateEnrichedCurriculumDays(enrichedDays);
  if (semanticValidation.failures.length > 0) {
    throw new CurriculumSourceError(
      "CURRICULUM_SOURCE_INVALID",
      `Curriculum enrichment failed semantic validation with ${semanticValidation.failures.length} issue(s).`,
      inspection.report
    );
  }
  let index: RuntimeCurriculumDayIndex;
  try {
    index = createImmutableDayIndex(enrichedDays);
  } catch (error: unknown) {
    throw new CurriculumSourceError(
      "CURRICULUM_SOURCE_INVALID",
      error instanceof Error ? error.message : "Cannot index curriculum days.",
      inspection.report
    );
  }
  const blueprint = deepFreeze(inspection.blueprint);
  const loaded: LoadedCurriculum = {
    blueprint,
    index,
    preflight: deepFreeze(inspection.report),
    getDay(dayNumber: number): CurriculumDayResponse | undefined {
      return index.get(dayNumber);
    }
  };

  return Object.freeze(loaded);
}

export const loadCanonicalCurriculum = loadCurriculumBlueprint;
