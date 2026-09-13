import {
  authSessionResponseSchema,
  csrfResponseSchema,
  deleteAccountRequestSchema,
  loginRequestSchema,
  meResponseSchema,
  mvpConfigurationResponseSchema,
  onboardingRequestSchema,
  onboardingResponseSchema,
  progressEvidenceRequestSchema,
  progressReflectionRequestSchema,
  progressStatusRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema
} from "@codelift/contracts";
import { parseCookie, stringifySetCookie } from "cookie";
import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ZodError, ZodType } from "zod";

import type { ApiConfig } from "../config.js";
import { HttpProblem, sendProblem } from "../http/problem.js";
import { createLearningRouter } from "../learning/router.js";
import { LearningService } from "../learning/service.js";
import type { PersistenceRuntime } from "../persistence/runtime.js";
import { AccountService, type SessionIdentity } from "./service.js";

export type AccountRuntime =
  | {
      readonly status: "ready";
      readonly service: AccountService;
      readonly learning: LearningService;
    }
  | {
      readonly status: "unavailable";
    };

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

function validationProblem(error: ZodError): HttpProblem {
  const firstIssue = error.issues[0];
  const path = firstIssue?.path.join(".") ?? "request";
  const message = firstIssue?.message ?? "The request did not match the expected contract.";
  return new HttpProblem({
    type: "https://codelift.ai/problems/validation-failed",
    title: "Validation failed",
    status: 422,
    detail: `${path}: ${message}`
  });
}

function parseBody<Output>(schema: ZodType<Output>, body: unknown): Output {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationProblem(result.error);
  }
  return result.data;
}

function parseDayNumber(rawValue: string | string[] | undefined): number {
  if (Array.isArray(rawValue)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/invalid-day-number",
      title: "Invalid curriculum day",
      status: 400,
      detail: "dayNumber must be one integer from 1 through 365."
    });
  }
  if (rawValue === undefined || !/^[1-9]\d{0,2}$/.test(rawValue)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/invalid-day-number",
      title: "Invalid curriculum day",
      status: 400,
      detail: "dayNumber must be an integer from 1 through 365."
    });
  }
  const dayNumber = Number(rawValue);
  if (!Number.isSafeInteger(dayNumber) || dayNumber < 1 || dayNumber > 365) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/invalid-day-number",
      title: "Invalid curriculum day",
      status: 400,
      detail: "dayNumber must be an integer from 1 through 365."
    });
  }
  return dayNumber;
}

function cookieToken(request: Request, config: ApiConfig): string | null {
  const header = request.headers.cookie;
  if (header === undefined) {
    return null;
  }
  try {
    return parseCookie(header)[config.session.cookieName] ?? null;
  } catch {
    return null;
  }
}

function csrfToken(request: Request): string | null {
  const header = request.get("X-CSRF-Token");
  return header === undefined || header.length === 0 ? null : header;
}

function setSessionCookie(
  response: Response,
  config: ApiConfig,
  token: string,
  expiresAt: Date
): void {
  response.append(
    "Set-Cookie",
    stringifySetCookie({
      name: config.session.cookieName,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: config.session.secureCookie,
      path: "/",
      expires: expiresAt
    })
  );
}

function clearSessionCookie(response: Response, config: ApiConfig): void {
  response.append(
    "Set-Cookie",
    stringifySetCookie({
      name: config.session.cookieName,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: config.session.secureCookie,
      path: "/",
      expires: new Date(0),
      maxAge: 0
    })
  );
}

function requireExactOrigin(request: Request, config: ApiConfig): void {
  if (request.get("Origin") !== config.webOrigin) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/csrf-invalid",
      title: "Security check failed",
      status: 403,
      detail: "The request origin did not match the configured CodeLift web application."
    });
  }
}

function accountUnavailable(response: Response): void {
  sendProblem(response, {
    type: "https://codelift.ai/problems/service-unavailable",
    title: "Private workspace unavailable",
    status: 503,
    detail:
      "The public curriculum preview is available, but account storage is not ready. Try again after MongoDB is available."
  });
}

export async function initializeAccountRuntime(
  persistence: PersistenceRuntime,
  options: Omit<Parameters<typeof AccountService.create>[0], "models"> & {
    aiConfig: ApiConfig["ai"];
  }
): Promise<AccountRuntime> {
  if (persistence.status !== "ready") {
    return {
      status: "unavailable"
    };
  }

  const service = await AccountService.create({
    ...options,
    models: persistence.models
  });
  return {
    status: "ready",
    service,
    learning: new LearningService({
      models: persistence.models,
      curriculum: options.curriculum,
      aiConfig: options.aiConfig,
      ...(options.now === undefined ? {} : { now: options.now })
    })
  };
}

export function createAccountRouter(options: {
  config: ApiConfig;
  runtime: AccountRuntime;
}): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/config", (_request, response) => {
    response.status(200).json(
      mvpConfigurationResponseSchema.parse({
        registrationMode: options.config.registration.mode,
        aiProvider: options.config.ai.provider,
        externalAiEnabled: options.config.ai.externalEnabled,
        agentEnabled: options.config.ai.agentEnabled,
        emailSelfServiceEnabled: options.config.email.provider !== "disabled"
      })
    );
  });

  if (options.runtime.status !== "ready") {
    router.use((_request, response) => {
      accountUnavailable(response);
    });
    return router;
  }

  const service = options.runtime.service;
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      sendProblem(response, {
        type: "https://codelift.ai/problems/rate-limit-exceeded",
        title: "Too many attempts",
        status: 429,
        detail: "Wait before trying this account action again."
      });
    }
  });
  const csrfLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      sendProblem(response, {
        type: "https://codelift.ai/problems/rate-limit-exceeded",
        title: "Too many attempts",
        status: 429,
        detail: "Wait before requesting another browser session."
      });
    }
  });
  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      sendProblem(response, {
        type: "https://codelift.ai/problems/rate-limit-exceeded",
        title: "Too many attempts",
        status: 429,
        detail: "Wait before trying another recovery link."
      });
    }
  });
  const mutationLimiter = rateLimit({
    windowMs: 60 * 1_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  async function verifiedIdentity(request: Request): Promise<SessionIdentity> {
    requireExactOrigin(request, options.config);
    return service.verifyCsrf(cookieToken(request, options.config), csrfToken(request));
  }

  async function authenticatedIdentity(request: Request): Promise<SessionIdentity> {
    const identity = await verifiedIdentity(request);
    const authenticated = await service.authenticate(cookieToken(request, options.config));
    if (identity.userId === null || identity.userId !== authenticated.identity.userId) {
      throw new HttpProblem({
        type: "https://codelift.ai/problems/authentication-required",
        title: "Authentication required",
        status: 401,
        detail: "Sign in to continue to this private workspace."
      });
    }
    return identity;
  }

  async function privateIdentity(request: Request): Promise<SessionIdentity> {
    return (await service.authenticate(cookieToken(request, options.config))).identity;
  }

  router.get(
    "/auth/csrf",
    csrfLimiter,
    asyncHandler(async (request, response) => {
      const issued = await service.issueCsrf(cookieToken(request, options.config));
      setSessionCookie(response, options.config, issued.sessionToken, issued.expiresAt);
      response.status(200).json(
        csrfResponseSchema.parse({
          csrfToken: issued.csrfToken,
          expiresAt: issued.expiresAt.toISOString()
        })
      );
    })
  );

  router.post(
    "/auth/register",
    authLimiter,
    asyncHandler(async (request, response) => {
      const identity = await verifiedIdentity(request);
      const input = parseBody(registerRequestSchema, request.body);
      const result = await service.register(
        identity,
        input.email,
        input.password,
        input.invitationToken
      );
      setSessionCookie(response, options.config, result.sessionToken, result.expiresAt);
      response.status(201).json(
        authSessionResponseSchema.parse({
          authenticated: true,
          user: result.user,
          csrfToken: result.csrfToken
        })
      );
    })
  );

  router.post(
    "/auth/login",
    authLimiter,
    asyncHandler(async (request, response) => {
      const identity = await verifiedIdentity(request);
      const input = parseBody(loginRequestSchema, request.body);
      const result = await service.login(identity, input.email, input.password);
      setSessionCookie(response, options.config, result.sessionToken, result.expiresAt);
      response.status(200).json(
        authSessionResponseSchema.parse({
          authenticated: true,
          user: result.user,
          csrfToken: result.csrfToken
        })
      );
    })
  );

  router.post(
    "/auth/reset-password",
    resetLimiter,
    asyncHandler(async (request, response) => {
      await verifiedIdentity(request);
      const input = parseBody(passwordResetRequestSchema, request.body);
      await service.resetPassword(input.token, input.password);
      clearSessionCookie(response, options.config);
      response.status(204).end();
    })
  );

  router.post(
    "/auth/logout",
    mutationLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      await service.logout(identity);
      clearSessionCookie(response, options.config);
      response.status(204).end();
    })
  );

  router.get(
    "/me",
    asyncHandler(async (request, response) => {
      const token = cookieToken(request, options.config);
      const user = await service.me(token);
      if (user === null && token !== null) {
        clearSessionCookie(response, options.config);
      }
      response.status(200).json(
        meResponseSchema.parse(
          user === null
            ? { authenticated: false }
            : {
                authenticated: true,
                user
              }
        )
      );
    })
  );

  router.put(
    "/me/onboarding",
    mutationLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      const input = parseBody(onboardingRequestSchema, request.body);
      if (identity.userId === null) {
        throw new Error("Authenticated identity unexpectedly lacked a user ID.");
      }
      const user = await service.saveOnboarding(identity.userId, input);
      response.status(200).json(onboardingResponseSchema.parse({ user }));
    })
  );

  router.get(
    "/me/today",
    asyncHandler(async (request, response) => {
      const authenticated = await service.authenticate(cookieToken(request, options.config));
      const result = await service.today(authenticated.identity.userId ?? "");
      response.status(200).json(result);
    })
  );

  router.get(
    "/me/export",
    asyncHandler(async (request, response) => {
      const identity = await privateIdentity(request);
      const exported = await service.exportAccount(identity.userId ?? "");
      const body = `${JSON.stringify(exported, null, 2)}\n`;
      if (Buffer.byteLength(body, "utf8") > 10 * 1_024 * 1_024) {
        throw new HttpProblem({
          type: "https://codelift.ai/problems/export-too-large",
          title: "Account export too large",
          status: 413,
          detail:
            "The bounded private-pilot export exceeded 10 MiB. Contact support for an isolated export."
        });
      }
      await service.recordPilotEvent("account_export_succeeded");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="codelift-account-export-${new Date().toISOString().slice(0, 10)}.json"`
      );
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.status(200).send(body);
    })
  );

  router.put(
    "/progress/:dayNumber/status",
    mutationLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      const input = parseBody(progressStatusRequestSchema, request.body);
      const dayNumber = parseDayNumber(request.params.dayNumber);
      const result = await service.updateStatus(identity.userId ?? "", dayNumber, input);
      response.status(200).json(result);
    })
  );

  router.post(
    "/progress/:dayNumber/evidence",
    mutationLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      const input = parseBody(progressEvidenceRequestSchema, request.body);
      const dayNumber = parseDayNumber(request.params.dayNumber);
      const result = await service.addEvidence(identity.userId ?? "", dayNumber, input);
      response.status(200).json(result);
    })
  );

  router.put(
    "/progress/:dayNumber/reflection",
    mutationLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      const input = parseBody(progressReflectionRequestSchema, request.body);
      const dayNumber = parseDayNumber(request.params.dayNumber);
      const result = await service.saveReflection(identity.userId ?? "", dayNumber, input);
      response.status(200).json(result);
    })
  );

  router.delete(
    "/me",
    authLimiter,
    asyncHandler(async (request, response) => {
      const identity = await authenticatedIdentity(request);
      const input = parseBody(deleteAccountRequestSchema, request.body);
      await service.deleteAccount(identity, input.password, input.confirmation);
      clearSessionCookie(response, options.config);
      response.status(204).end();
    })
  );

  router.use(
    createLearningRouter({
      service: options.runtime.learning,
      authenticateRead: privateIdentity,
      authenticateMutation: authenticatedIdentity,
      mutationLimiter,
      nodeEnv: options.config.nodeEnv
    })
  );

  return router;
}
