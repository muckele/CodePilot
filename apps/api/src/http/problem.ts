import { problemDetailsSchema, type ProblemDetails } from "@codelift/contracts";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";

export interface HttpProblemOptions {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
}

export class HttpProblem extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string | undefined;

  constructor(options: HttpProblemOptions) {
    super(options.title);
    this.name = "HttpProblem";
    this.type = options.type;
    this.title = options.title;
    this.status = options.status;
    this.detail = options.detail;
  }
}

function responseRequestId(response: Response): string | undefined {
  const value = response.getHeader("X-Request-ID");
  return typeof value === "string" ? value : undefined;
}

function createProblemDetails(
  options: HttpProblemOptions,
  requestId: string | undefined
): ProblemDetails {
  return problemDetailsSchema.parse({
    type: options.type,
    title: options.title,
    status: options.status,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
    ...(requestId === undefined ? {} : { requestId })
  });
}

export function sendProblem(response: Response, options: HttpProblemOptions): void {
  const problem = createProblemDetails(options, responseRequestId(response));

  response.status(problem.status).type("application/problem+json").send(problem);
}

function numericErrorField(error: object, field: "status" | "statusCode"): number | undefined {
  if (!(field in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "number" ? value : undefined;
}

function stringErrorField(error: object, field: "type"): string | undefined {
  if (!(field in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function isMalformedJsonError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const status = numericErrorField(error, "status") ?? numericErrorField(error, "statusCode");

  return status === 400;
}

function isPayloadTooLargeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const status = numericErrorField(error, "status") ?? numericErrorField(error, "statusCode");

  return status === 413 || stringErrorField(error, "type") === "entity.too.large";
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  sendProblem(response, {
    type: "https://codelift.ai/problems/not-found",
    title: "Route not found",
    status: 404,
    detail: "No API route matches this request."
  });
};

export const problemErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next
) => {
  // Express recognizes error middleware by its four-argument signature.
  void next;

  if (error instanceof HttpProblem) {
    sendProblem(response, {
      type: error.type,
      title: error.title,
      status: error.status,
      ...(error.detail === undefined ? {} : { detail: error.detail })
    });
    return;
  }

  if (isPayloadTooLargeError(error)) {
    sendProblem(response, {
      type: "https://codelift.ai/problems/payload-too-large",
      title: "Payload too large",
      status: 413,
      detail: "The JSON request body exceeds the allowed size."
    });
    return;
  }

  if (isMalformedJsonError(error)) {
    sendProblem(response, {
      type: "https://codelift.ai/problems/malformed-json",
      title: "Malformed JSON",
      status: 400,
      detail: "The request body is not valid JSON."
    });
    return;
  }

  sendProblem(response, {
    type: "https://codelift.ai/problems/internal-error",
    title: "Internal server error",
    status: 500,
    detail: "The API could not complete the request."
  });
};
