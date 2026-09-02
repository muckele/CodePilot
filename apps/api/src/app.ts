import { CURRICULUM_LIMITS } from "@codelift/config";
import { curriculumDayResponseSchema, type CurriculumDayResponse } from "@codelift/contracts";
import cors from "cors";
import express, { type Request, type RequestHandler, type Response } from "express";
import helmet from "helmet";
import { createAccountRouter, type AccountRuntime } from "./account/router.js";
import type { ApiConfig } from "./config.js";
import type { CurriculumRuntime } from "./curriculum/runtime.js";
import {
  createProblemErrorHandler,
  HttpProblem,
  notFoundHandler,
  sendProblem
} from "./http/problem.js";
import {
  assignRequestId,
  logRequests,
  standardRequestLogger,
  type StructuredRequestLogger
} from "./middleware/request-context.js";

export interface CreateAppOptions {
  readonly config: ApiConfig;
  readonly curriculum: CurriculumRuntime;
  readonly account?: AccountRuntime;
  readonly logger?: StructuredRequestLogger;
}

function parseDayNumber(value: string): number {
  if (!/^[1-9]\d{0,2}$/.test(value)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/invalid-day-number",
      title: "Invalid curriculum day",
      status: 400,
      detail: `dayNumber must be an integer from ${CURRICULUM_LIMITS.firstDay} through ${CURRICULUM_LIMITS.lastDay}.`
    });
  }

  const dayNumber = Number(value);

  if (
    !Number.isSafeInteger(dayNumber) ||
    dayNumber < CURRICULUM_LIMITS.firstDay ||
    dayNumber > CURRICULUM_LIMITS.lastDay
  ) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/invalid-day-number",
      title: "Invalid curriculum day",
      status: 400,
      detail: `dayNumber must be an integer from ${CURRICULUM_LIMITS.firstDay} through ${CURRICULUM_LIMITS.lastDay}.`
    });
  }

  return dayNumber;
}

function unavailableProblem(response: Response): void {
  sendProblem(response, {
    type: "https://codelift.ai/problems/curriculum-unavailable",
    title: "Curriculum unavailable",
    status: 503,
    detail: "The curriculum did not pass startup validation."
  });
}

function sendCurriculumDay(
  response: Response,
  curriculum: CurriculumRuntime,
  dayNumber: number
): void {
  if (curriculum.status !== "ready") {
    unavailableProblem(response);
    return;
  }

  const day = curriculum.getDay(dayNumber);

  if (day === undefined) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/curriculum-day-not-found",
      title: "Curriculum day not found",
      status: 404,
      detail: "The requested curriculum day does not exist."
    });
  }

  const payload: CurriculumDayResponse = curriculumDayResponseSchema.parse(day);
  response.status(200).json(payload);
}

export function createApp(options: CreateAppOptions): express.Express {
  const app = express();
  const logger = options.logger ?? standardRequestLogger;

  app.disable("x-powered-by");
  if (options.config.trustProxyHops > 0) {
    app.set("trust proxy", options.config.trustProxyHops);
  }
  app.use(assignRequestId);
  app.use(logRequests(logger));
  app.use(helmet());
  app.use(
    cors({
      origin(requestOrigin, callback) {
        callback(null, requestOrigin === undefined || requestOrigin === options.config.webOrigin);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"],
      maxAge: 600
    })
  );
  app.use(express.json({ limit: options.config.jsonBodyLimit }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "api"
    });
  });

  app.get("/ready", (_request, response) => {
    if (options.curriculum.status !== "ready") {
      unavailableProblem(response);
      return;
    }

    const accountReady = options.account?.status === "ready";
    if (!accountReady && options.config.persistence.mode === "required") {
      sendProblem(response, {
        type: "https://codelift.ai/problems/service-unavailable",
        title: "Persistence unavailable",
        status: 503,
        detail: "MongoDB and the session indexes must be ready in required persistence mode."
      });
      return;
    }

    response.status(200).json({
      status: accountReady ? "ready" : "degraded",
      service: "api",
      curriculum: {
        dayCount: options.curriculum.dayCount
      },
      capabilities: {
        publicPreview: true,
        privateAccounts: accountReady
      }
    });
  });

  app.get("/api/v1/curriculum/today", (_request, response) => {
    sendCurriculumDay(response, options.curriculum, 1);
  });

  app.get("/api/v1/curriculum", (_request, response) => {
    if (options.curriculum.status !== "ready") {
      unavailableProblem(response);
      return;
    }
    response.status(200).json({
      sourceSha256: options.curriculum.sourceSha256,
      dayCount: options.curriculum.dayCount,
      days: options.curriculum.days
    });
  });

  const curriculumDayHandler: RequestHandler<{
    dayNumber: string;
  }> = (request: Request<{ dayNumber: string }>, response: Response) => {
    sendCurriculumDay(response, options.curriculum, parseDayNumber(request.params.dayNumber));
  };

  app.get("/api/v1/curriculum/:dayNumber", curriculumDayHandler);

  if (options.config.nodeEnv === "production") {
    app.use("/api/v1/admin", (_request, response) => {
      response.setHeader("Cache-Control", "no-store");
      sendProblem(response, {
        type: "https://codelift.ai/problems/not-found",
        title: "Route not found",
        status: 404,
        detail: "The requested resource does not exist."
      });
    });
  }

  app.use(
    "/api/v1",
    createAccountRouter({
      config: options.config,
      runtime: options.account ?? { status: "unavailable" }
    })
  );

  app.use(notFoundHandler);
  app.use(createProblemErrorHandler(logger));

  return app;
}
