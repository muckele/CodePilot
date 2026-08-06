import { CurriculumSourceError, loadCurriculumBlueprint } from "@codelift/curriculum";
import type { CurriculumDayResponse, CurriculumResource } from "@codelift/contracts";

export interface ReadyCurriculum {
  readonly status: "ready";
  readonly dayCount: number;
  readonly sourceSha256: string;
  readonly days: readonly CurriculumDayResponse[];
  readonly resources: Readonly<Record<string, CurriculumResource>>;
  readonly getDay: (dayNumber: number) => CurriculumDayResponse | undefined;
}

export interface UnreadyCurriculum {
  readonly status: "unready";
  readonly failureCode: string;
}

export type CurriculumRuntime = ReadyCurriculum | UnreadyCurriculum;

export async function initializeCurriculum(
  absoluteCurriculumPath: string
): Promise<CurriculumRuntime> {
  try {
    const loaded = await loadCurriculumBlueprint(absoluteCurriculumPath);

    return {
      status: "ready",
      dayCount: loaded.blueprint.days.length,
      sourceSha256: loaded.preflight.sourceSha256 ?? "unknown",
      days: [...loaded.index.values()],
      resources: loaded.blueprint.resourceCatalog,
      getDay: (dayNumber) => loaded.getDay(dayNumber)
    };
  } catch (error: unknown) {
    return {
      status: "unready",
      failureCode:
        error instanceof CurriculumSourceError ? error.code : "unexpected-curriculum-load-error"
    };
  }
}
