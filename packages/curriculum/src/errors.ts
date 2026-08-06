import type { CurriculumPreflightReport } from "./preflight.js";

export type CurriculumSourceErrorCode =
  "CURRICULUM_SOURCE_INVALID" | "CURRICULUM_SOURCE_UNAVAILABLE";

export class CurriculumSourceError extends Error {
  readonly code: CurriculumSourceErrorCode;
  readonly preflight: CurriculumPreflightReport;

  constructor(
    code: CurriculumSourceErrorCode,
    message: string,
    preflight: CurriculumPreflightReport
  ) {
    super(message);
    this.name = "CurriculumSourceError";
    this.code = code;
    this.preflight = preflight;
  }
}
