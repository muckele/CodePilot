import {
  curriculumDayResponseSchema,
  problemDetailsSchema,
  type CurriculumDayResponse
} from "@codelift/contracts";

export type CurriculumLoadErrorKind = "network" | "problem" | "malformed";

type CurriculumLoadErrorOptions = {
  kind: CurriculumLoadErrorKind;
  message: string;
  status?: number;
  requestId?: string;
};

export class CurriculumLoadError extends Error {
  readonly kind: CurriculumLoadErrorKind;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor({ kind, message, status, requestId }: CurriculumLoadErrorOptions) {
    super(message);
    this.name = "CurriculumLoadError";
    this.kind = kind;
    this.status = status ?? null;
    this.requestId = requestId ?? null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json();
    return payload;
  } catch {
    return null;
  }
}

export async function fetchCurriculumDay(
  dayNumber: number,
  signal?: AbortSignal
): Promise<CurriculumDayResponse> {
  let response: Response;

  try {
    response = await fetch(`/api/v1/curriculum/${dayNumber}`, {
      method: "GET",
      headers: {
        Accept: "application/json, application/problem+json"
      },
      cache: "no-store",
      ...(signal === undefined ? {} : { signal })
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new CurriculumLoadError({
      kind: "network",
      message:
        "CodeLift could not reach its Node API. Check that the local API is running, then try again."
    });
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const parsedProblem = problemDetailsSchema.safeParse(payload);

    if (parsedProblem.success) {
      throw new CurriculumLoadError({
        kind: "problem",
        message: parsedProblem.data.detail ?? parsedProblem.data.title,
        status: parsedProblem.data.status,
        ...(parsedProblem.data.requestId === undefined
          ? {}
          : { requestId: parsedProblem.data.requestId })
      });
    }

    throw new CurriculumLoadError({
      kind: "problem",
      message: `The curriculum API returned an unverified error response (HTTP ${response.status}).`,
      status: response.status
    });
  }

  const parsedDay = curriculumDayResponseSchema.safeParse(payload);

  if (!parsedDay.success) {
    throw new CurriculumLoadError({
      kind: "malformed",
      message:
        "The API responded, but its mission did not match the shared CodeLift contract. Nothing unverified was displayed."
    });
  }

  return parsedDay.data;
}
