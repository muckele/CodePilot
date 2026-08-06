import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";

export interface RequestLogRecord {
  readonly event: "http.request";
  readonly requestId: string;
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
}

export interface StructuredRequestLogger {
  info(record: RequestLogRecord): void;
}

export const standardRequestLogger: StructuredRequestLogger = {
  info(record) {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
};

function normalizedRoute(request: Request): string {
  const routePath = request.route?.path;

  if (typeof routePath !== "string") {
    return "unmatched";
  }

  return `${request.baseUrl}${routePath}`;
}

export const assignRequestId: RequestHandler = (_request, response, next) => {
  response.setHeader("X-Request-ID", randomUUID());
  next();
};

export function logRequests(logger: StructuredRequestLogger): RequestHandler {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();

    response.once("finish", () => {
      const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
      const requestIdHeader = response.getHeader("X-Request-ID");
      const requestId = typeof requestIdHeader === "string" ? requestIdHeader : "missing";

      logger.info({
        event: "http.request",
        requestId,
        method: request.method,
        route: normalizedRoute(request),
        statusCode: response.statusCode,
        durationMs: Math.round((Number(elapsedNanoseconds) / 1_000_000) * 1_000) / 1_000
      });
    });

    next();
  };
}
