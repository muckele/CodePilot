import {
  authenticatedTodayResponseSchema,
  authSessionResponseSchema,
  csrfResponseSchema,
  deleteAccountRequestSchema,
  loginRequestSchema,
  meResponseSchema,
  mvpConfigurationResponseSchema,
  onboardingRequestSchema,
  onboardingResponseSchema,
  problemDetailsSchema,
  passwordResetRequestSchema,
  progressDayResponseSchema,
  progressEvidenceRequestSchema,
  progressReflectionRequestSchema,
  progressStatusRequestSchema,
  registerRequestSchema
} from "@codelift/contracts";

type ContractResult<Output> =
  | {
      success: true;
      data: Output;
    }
  | {
      success: false;
    };

type RuntimeContract<Output> = {
  safeParse(input: unknown): ContractResult<Output>;
};

export type AuthSessionResponse = ReturnType<typeof authSessionResponseSchema.parse>;
export type CsrfResponse = ReturnType<typeof csrfResponseSchema.parse>;
export type MeResponse = ReturnType<typeof meResponseSchema.parse>;
export type OnboardingResponse = ReturnType<typeof onboardingResponseSchema.parse>;
export type AuthenticatedTodayResponse = ReturnType<typeof authenticatedTodayResponseSchema.parse>;
export type ProgressDayResponse = ReturnType<typeof progressDayResponseSchema.parse>;
export type MvpConfigurationResponse = ReturnType<typeof mvpConfigurationResponseSchema.parse>;

export type AccountApiErrorKind = "network" | "problem" | "malformed" | "request-validation";

type AccountApiErrorOptions = {
  kind: AccountApiErrorKind;
  message: string;
  status?: number;
  problemType?: string;
  requestId?: string;
};

export class AccountApiError extends Error {
  readonly kind: AccountApiErrorKind;
  readonly status: number | null;
  readonly problemType: string | null;
  readonly requestId: string | null;

  constructor({ kind, message, status, problemType, requestId }: AccountApiErrorOptions) {
    super(message);
    this.name = "AccountApiError";
    this.kind = kind;
    this.status = status ?? null;
    this.problemType = problemType ?? null;
    this.requestId = requestId ?? null;
  }

  get isAuthenticationFailure(): boolean {
    return this.status === 401;
  }

  get isCsrfFailure(): boolean {
    return this.status === 403 && (this.problemType?.includes("csrf") ?? false);
  }
}

type RequestOptions<Output> = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  csrfToken?: string;
  responseContract: RuntimeContract<Output>;
  signal?: AbortSignal;
};

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

async function requestJson<Output>(
  path: string,
  { method = "GET", body, csrfToken, responseContract, signal }: RequestOptions<Output>
): Promise<Output> {
  const unsafe = method !== "GET";

  if (unsafe && csrfToken === undefined) {
    throw new AccountApiError({
      kind: "request-validation",
      message: "A current CSRF token is required for this request."
    });
  }

  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json, application/problem+json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(csrfToken === undefined ? {} : { "X-CSRF-Token": csrfToken })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal === undefined ? {} : { signal })
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new AccountApiError({
      kind: "network",
      message: "CodeLift could not reach its Node API. Check the connection, then try again."
    });
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const parsedProblem = problemDetailsSchema.safeParse(payload);

    if (parsedProblem.success) {
      throw new AccountApiError({
        kind: "problem",
        message: parsedProblem.data.detail ?? parsedProblem.data.title,
        status: parsedProblem.data.status,
        problemType: parsedProblem.data.type,
        ...(parsedProblem.data.requestId === undefined
          ? {}
          : { requestId: parsedProblem.data.requestId })
      });
    }

    throw new AccountApiError({
      kind: "problem",
      message: `The CodeLift API returned an unverified error response (HTTP ${response.status}).`,
      status: response.status
    });
  }

  const parsedResponse = responseContract.safeParse(payload);

  if (!parsedResponse.success) {
    throw new AccountApiError({
      kind: "malformed",
      message:
        "The API responded, but the result did not match the shared CodeLift contract. Nothing unverified was applied."
    });
  }

  return parsedResponse.data;
}

async function requestNoContent(
  path: string,
  {
    method,
    body,
    csrfToken
  }: {
    method: "POST" | "DELETE";
    body?: unknown;
    csrfToken: string;
  }
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json, application/problem+json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-CSRF-Token": csrfToken
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new AccountApiError({
      kind: "network",
      message: "CodeLift could not reach its Node API. Check the connection, then try again."
    });
  }

  if (response.ok) {
    return;
  }

  const payload = await readJson(response);
  const parsedProblem = problemDetailsSchema.safeParse(payload);

  if (parsedProblem.success) {
    throw new AccountApiError({
      kind: "problem",
      message: parsedProblem.data.detail ?? parsedProblem.data.title,
      status: parsedProblem.data.status,
      problemType: parsedProblem.data.type,
      ...(parsedProblem.data.requestId === undefined
        ? {}
        : { requestId: parsedProblem.data.requestId })
    });
  }

  throw new AccountApiError({
    kind: "problem",
    message: `The CodeLift API returned an unverified error response (HTTP ${response.status}).`,
    status: response.status
  });
}

function parseRequest<Output>(contract: RuntimeContract<Output>, input: unknown): Output {
  const result = contract.safeParse(input);

  if (!result.success) {
    throw new AccountApiError({
      kind: "request-validation",
      message: "The form contains fields that do not match the shared CodeLift contract."
    });
  }

  return result.data;
}

export function fetchCsrf(signal?: AbortSignal): Promise<CsrfResponse> {
  return requestJson("/api/v1/auth/csrf", {
    responseContract: csrfResponseSchema,
    ...(signal === undefined ? {} : { signal })
  });
}

export function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  return requestJson("/api/v1/me", {
    responseContract: meResponseSchema,
    ...(signal === undefined ? {} : { signal })
  });
}

export function fetchMvpConfiguration(signal?: AbortSignal): Promise<MvpConfigurationResponse> {
  return requestJson("/api/v1/config", {
    responseContract: mvpConfigurationResponseSchema,
    ...(signal === undefined ? {} : { signal })
  });
}

export function registerAccount(input: unknown, csrfToken: string): Promise<AuthSessionResponse> {
  return requestJson("/api/v1/auth/register", {
    method: "POST",
    body: parseRequest(registerRequestSchema, input),
    csrfToken,
    responseContract: authSessionResponseSchema
  });
}

export function loginAccount(input: unknown, csrfToken: string): Promise<AuthSessionResponse> {
  return requestJson("/api/v1/auth/login", {
    method: "POST",
    body: parseRequest(loginRequestSchema, input),
    csrfToken,
    responseContract: authSessionResponseSchema
  });
}

export function logoutAccount(csrfToken: string): Promise<void> {
  return requestNoContent("/api/v1/auth/logout", {
    method: "POST",
    csrfToken
  });
}

export function resetPassword(input: unknown, csrfToken: string): Promise<void> {
  return requestNoContent("/api/v1/auth/reset-password", {
    method: "POST",
    body: parseRequest(passwordResetRequestSchema, input),
    csrfToken
  });
}

export function saveOnboarding(input: unknown, csrfToken: string): Promise<OnboardingResponse> {
  return requestJson("/api/v1/me/onboarding", {
    method: "PUT",
    body: parseRequest(onboardingRequestSchema, input),
    csrfToken,
    responseContract: onboardingResponseSchema
  });
}

export function fetchAuthenticatedToday(signal?: AbortSignal): Promise<AuthenticatedTodayResponse> {
  return requestJson("/api/v1/me/today", {
    responseContract: authenticatedTodayResponseSchema,
    ...(signal === undefined ? {} : { signal })
  });
}

export function updateProgressStatus(
  dayNumber: number,
  input: unknown,
  csrfToken: string
): Promise<ProgressDayResponse> {
  return requestJson(`/api/v1/progress/${dayNumber}/status`, {
    method: "PUT",
    body: parseRequest(progressStatusRequestSchema, input),
    csrfToken,
    responseContract: progressDayResponseSchema
  });
}

export function addProgressEvidence(
  dayNumber: number,
  input: unknown,
  csrfToken: string
): Promise<ProgressDayResponse> {
  return requestJson(`/api/v1/progress/${dayNumber}/evidence`, {
    method: "POST",
    body: parseRequest(progressEvidenceRequestSchema, input),
    csrfToken,
    responseContract: progressDayResponseSchema
  });
}

export function saveProgressReflection(
  dayNumber: number,
  input: unknown,
  csrfToken: string
): Promise<ProgressDayResponse> {
  return requestJson(`/api/v1/progress/${dayNumber}/reflection`, {
    method: "PUT",
    body: parseRequest(progressReflectionRequestSchema, input),
    csrfToken,
    responseContract: progressDayResponseSchema
  });
}

export function deleteAccount(input: unknown, csrfToken: string): Promise<void> {
  return requestNoContent("/api/v1/me", {
    method: "DELETE",
    body: parseRequest(deleteAccountRequestSchema, input),
    csrfToken
  });
}
