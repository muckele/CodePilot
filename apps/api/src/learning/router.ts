import {
  adminFeatureFlagUpdateRequestSchema,
  adminMockScenarioRequestSchema,
  adminResetDemoDataRequestSchema,
  catchUpPlanRequestSchema,
  coachRequestSchema,
  createJobApplicationRequestSchema,
  plannerDecisionRequestSchema,
  plannerRequestSchema,
  ragSearchRequestSchema,
  submitReviewRequestSchema,
  updateDayTaskPlanRequestSchema,
  updatePeriodicReflectionRequestSchema,
  updatePortfolioArtifactRequestSchema,
  upsertErrorMuseumRequestSchema,
  upsertNoteRequestSchema
} from "@codelift/contracts";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { RequestHandler } from "express";
import type { ZodError, ZodType } from "zod";

import type { ApiEnvironment } from "../config.js";
import { HttpProblem } from "../http/problem.js";
import type { SessionIdentity } from "../account/service.js";
import type { LearningService } from "./service.js";

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

function validationProblem(error: ZodError): HttpProblem {
  const firstIssue = error.issues[0];
  const path = firstIssue?.path.join(".") ?? "request";
  return new HttpProblem({
    type: "https://codelift.ai/problems/validation-failed",
    title: "Validation failed",
    status: 422,
    detail: `${path}: ${firstIssue?.message ?? "The request did not match the expected contract."}`
  });
}

function parseBody<Output>(schema: ZodType<Output>, body: unknown): Output {
  const result = schema.safeParse(body);
  if (!result.success) throw validationProblem(result.error);
  return result.data;
}

function userId(identity: SessionIdentity): string {
  if (identity.userId === null) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/authentication-required",
      title: "Authentication required",
      status: 401,
      detail: "Sign in to continue to this private workspace."
    });
  }
  return identity.userId;
}

function identifier(value: string | string[] | undefined, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{24}$/i.test(value)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/validation-failed",
      title: "Validation failed",
      status: 422,
      detail: `${label} must be a valid identifier.`
    });
  }
  return value;
}

function artifactKey(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,80}$/.test(value)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/validation-failed",
      title: "Validation failed",
      status: 422,
      detail: "artifactKey must contain lowercase letters, numbers, or hyphens."
    });
  }
  return value;
}

function curriculumDayNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/validation-failed",
      title: "Validation failed",
      status: 422,
      detail: "dayNumber must be an integer from 1 through 365."
    });
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > 365) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/validation-failed",
      title: "Validation failed",
      status: 422,
      detail: "dayNumber must be an integer from 1 through 365."
    });
  }
  return parsed;
}

function adminPreviewDayNumber(value: unknown): number {
  if (value === undefined) return 1;
  return curriculumDayNumber(typeof value === "string" ? value : undefined);
}

function featureFlagKey(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,80}$/.test(value)) {
    throw new HttpProblem({
      type: "https://codelift.ai/problems/validation-failed",
      title: "Validation failed",
      status: 422,
      detail: "key must contain lowercase letters, numbers, or hyphens."
    });
  }
  return value;
}

export function createLearningRouter(options: {
  service: LearningService;
  authenticateRead(request: Request): Promise<SessionIdentity>;
  authenticateMutation(request: Request): Promise<SessionIdentity>;
  mutationLimiter: RequestHandler;
  nodeEnv: ApiEnvironment;
}): Router {
  const router = Router();

  const read = (
    handler: (accountId: string, request: Request, response: Response) => Promise<void>
  ) =>
    asyncHandler(async (request, response) => {
      const identity = await options.authenticateRead(request);
      await handler(userId(identity), request, response);
    });
  const mutate = (
    handler: (accountId: string, request: Request, response: Response) => Promise<void>
  ) =>
    [
      options.mutationLimiter,
      asyncHandler(async (request, response) => {
        const identity = await options.authenticateMutation(request);
        await handler(userId(identity), request, response);
      })
    ] as const;

  router.get(
    "/dashboard",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.dashboard(accountId));
    })
  );
  router.get(
    "/roadmap",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.roadmap(accountId));
    })
  );
  router.get(
    "/progress",
    read(async (accountId, _request, response) => {
      const dashboard = await options.service.dashboard(accountId);
      response.status(200).json({
        summary: dashboard.summary,
        days: dashboard.journey,
        recentEvidence: dashboard.recentEvidence
      });
    })
  );
  router.post(
    "/progress/catch-up-plan",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(catchUpPlanRequestSchema, request.body);
      response.status(200).json(await options.service.catchUpPlan(accountId, input));
    })
  );
  router.get(
    "/tasks/:dayNumber",
    read(async (accountId, request, response) => {
      response
        .status(200)
        .json(
          await options.service.taskPlan(accountId, curriculumDayNumber(request.params.dayNumber))
        );
    })
  );
  router.put(
    "/tasks/:dayNumber",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(updateDayTaskPlanRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.updateTaskPlan(
            accountId,
            curriculumDayNumber(request.params.dayNumber),
            input
          )
        );
    })
  );

  router.get(
    "/reviews",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.reviews(accountId));
    })
  );
  router.get(
    "/reviews/due",
    read(async (accountId, _request, response) => {
      const reviews = await options.service.reviews(accountId);
      response.status(200).json({ reviews: reviews.due });
    })
  );
  router.put(
    "/reviews/:reviewId",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(submitReviewRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.submitReview(
            accountId,
            identifier(request.params.reviewId, "reviewId"),
            input
          )
        );
    })
  );
  router.get(
    "/reflections/periodic",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.periodicReflections(accountId));
    })
  );
  router.put(
    "/reflections/periodic/:dayNumber",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(updatePeriodicReflectionRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.savePeriodicReflection(
            accountId,
            curriculumDayNumber(request.params.dayNumber),
            input
          )
        );
    })
  );

  router.get(
    "/skills",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.skills(accountId));
    })
  );
  router.get(
    "/achievements",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.achievements(accountId));
    })
  );
  router.get(
    "/portfolio",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.portfolio(accountId));
    })
  );
  router.put(
    "/portfolio/:artifactKey",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(updatePortfolioArtifactRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.updatePortfolio(
            accountId,
            artifactKey(request.params.artifactKey),
            input
          )
        );
    })
  );
  router.get(
    "/career/applications",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.jobApplications(accountId));
    })
  );
  router.post(
    "/career/applications",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(createJobApplicationRequestSchema, request.body);
      response.status(201).json(await options.service.createJobApplication(accountId, input));
    })
  );

  router.get(
    "/errors",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.errors(accountId));
    })
  );
  router.post(
    "/errors",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(upsertErrorMuseumRequestSchema, request.body);
      response.status(201).json(await options.service.saveError(accountId, input));
    })
  );

  router.get(
    "/notes",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.notes(accountId));
    })
  );
  router.put(
    "/notes",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(upsertNoteRequestSchema, request.body);
      response.status(200).json(await options.service.saveNote(accountId, input));
    })
  );
  router.delete(
    "/notes/:sourceId",
    ...mutate(async (accountId, request, response) => {
      await options.service.deleteNote(accountId, identifier(request.params.sourceId, "sourceId"));
      response.status(204).end();
    })
  );
  router.post(
    "/search/notes",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(ragSearchRequestSchema, request.body);
      response.status(200).json(await options.service.search(accountId, input));
    })
  );

  for (const action of [
    "explain",
    "socratic",
    "reflect",
    "next-step",
    "weekly-recap",
    "portfolio-story"
  ] as const) {
    router.post(
      `/coach/${action}`,
      ...mutate(async (accountId, request, response) => {
        const canonicalAction = action.replaceAll("-", "_");
        const input = parseBody(coachRequestSchema, {
          ...(typeof request.body === "object" && request.body !== null ? request.body : {}),
          action: canonicalAction
        });
        response.status(200).json(await options.service.coach(accountId, input));
      })
    );
  }

  router.post(
    "/planner/week",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(plannerRequestSchema, request.body);
      response.status(201).json(await options.service.createPlan(accountId, input));
    })
  );
  router.post(
    "/planner/:runId/approve",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(plannerDecisionRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.decidePlan(
            accountId,
            identifier(request.params.runId, "runId"),
            input,
            "approve"
          )
        );
    })
  );
  router.post(
    "/planner/:runId/revise",
    ...mutate(async (accountId, request, response) => {
      const input = parseBody(plannerDecisionRequestSchema, request.body);
      response
        .status(200)
        .json(
          await options.service.decidePlan(
            accountId,
            identifier(request.params.runId, "runId"),
            input,
            "revise"
          )
        );
    })
  );

  router.get(
    "/ai/operations",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.operations(accountId));
    })
  );
  router.get(
    "/ai/traces",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.traces(accountId));
    })
  );
  router.get(
    "/evals/runs",
    read(async (accountId, _request, response) => {
      response.status(200).json(await options.service.evalRuns(accountId));
    })
  );
  router.post(
    "/evals/local",
    ...mutate(async (accountId, _request, response) => {
      response.status(201).json(await options.service.localEval(accountId));
    })
  );

  if (options.nodeEnv !== "production") {
    router.get(
      "/admin/overview",
      read(async (accountId, request, response) => {
        response
          .status(200)
          .json(
            await options.service.adminOverview(
              accountId,
              adminPreviewDayNumber(request.query.dayNumber)
            )
          );
      })
    );
    router.put(
      "/admin/feature-flags/:key",
      ...mutate(async (accountId, request, response) => {
        const input = parseBody(adminFeatureFlagUpdateRequestSchema, request.body);
        response
          .status(200)
          .json(
            await options.service.updateAdminFeatureFlag(
              accountId,
              featureFlagKey(request.params.key),
              input
            )
          );
      })
    );
    router.post(
      "/admin/mock-scenarios",
      ...mutate(async (accountId, request, response) => {
        const input = parseBody(adminMockScenarioRequestSchema, request.body);
        response.status(200).json(await options.service.runAdminMockScenario(accountId, input));
      })
    );
    router.post(
      "/admin/reset-demo-data",
      ...mutate(async (accountId, request, response) => {
        const input = parseBody(adminResetDemoDataRequestSchema, request.body);
        void input.confirmation;
        response.status(200).json(await options.service.resetAdminDemoData(accountId));
      })
    );
  }

  return router;
}
