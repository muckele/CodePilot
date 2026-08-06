import {
  adminFeatureFlagSchema,
  adminFeatureFlagUpdateRequestSchema,
  adminMockScenarioRequestSchema,
  adminMockScenarioResponseSchema,
  adminOverviewResponseSchema,
  adminResetDemoDataRequestSchema,
  adminResetDemoDataResponseSchema,
  catchUpPlanRequestSchema,
  catchUpPlanResponseSchema,
  coachRequestSchema,
  coachResponseSchema,
  createJobApplicationRequestSchema,
  dayTaskPlanSchema,
  dashboardResponseSchema,
  errorMuseumEntrySchema,
  errorMuseumResponseSchema,
  jobApplicationSchema,
  jobApplicationsResponseSchema,
  localEvalResponseSchema,
  noteResponseSchema,
  notesResponseSchema,
  operationsResponseSchema,
  periodicReflectionSchema,
  periodicReflectionsResponseSchema,
  plannerDecisionRequestSchema,
  plannerRequestSchema,
  plannerRunSchema,
  portfolioArtifactSchema,
  portfolioResponseSchema,
  problemDetailsSchema,
  ragSearchRequestSchema,
  ragSearchResponseSchema,
  reviewItemSchema,
  reviewsResponseSchema,
  roadmapResponseSchema,
  skillsResponseSchema,
  submitReviewRequestSchema,
  updateDayTaskPlanRequestSchema,
  updatePeriodicReflectionRequestSchema,
  updatePortfolioArtifactRequestSchema,
  upsertErrorMuseumRequestSchema,
  upsertNoteRequestSchema,
  type CatchUpPlanResponse,
  type AdminFeatureFlag,
  type AdminMockScenarioResponse,
  type AdminOverviewResponse,
  type AdminResetDemoDataResponse,
  type CoachResponse,
  type DashboardResponse,
  type DayTaskPlan,
  type ErrorMuseumEntry,
  type EvalRun,
  type JobApplication,
  type NoteSource,
  type OperationsResponse,
  type PeriodicReflection,
  type PlannerRun,
  type PortfolioArtifact,
  type PortfolioResponse,
  type RagSearchResponse,
  type ReviewItem,
  type ReviewsResponse,
  type RoadmapResponse,
  type SkillsResponse
} from "@codelift/contracts";
import { z, type ZodType } from "zod";

import { AccountApiError } from "../../account/api/accountApi";

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function request<Output>(
  path: string,
  contract: ZodType<Output>,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    csrfToken?: string;
    signal?: AbortSignal;
  } = {}
): Promise<Output> {
  const method = options.method ?? "GET";
  if (method !== "GET" && options.csrfToken === undefined) {
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
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.csrfToken === undefined ? {} : { "X-CSRF-Token": options.csrfToken })
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal === undefined ? {} : { signal: options.signal })
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AccountApiError({
      kind: "network",
      message: "CodeLift could not reach its Node API. Your saved data was not changed."
    });
  }
  const payload = await readJson(response);
  if (!response.ok) {
    const parsed = problemDetailsSchema.safeParse(payload);
    if (parsed.success) {
      throw new AccountApiError({
        kind: "problem",
        message: parsed.data.detail ?? parsed.data.title,
        status: parsed.data.status,
        problemType: parsed.data.type,
        ...(parsed.data.requestId === undefined ? {} : { requestId: parsed.data.requestId })
      });
    }
    throw new AccountApiError({
      kind: "problem",
      message: `The API returned an unverified response (HTTP ${response.status}).`,
      status: response.status
    });
  }
  const parsed = contract.safeParse(payload);
  if (!parsed.success) {
    throw new AccountApiError({
      kind: "malformed",
      message: "The API response did not match the shared CodeLift contract."
    });
  }
  return parsed.data;
}

function parseInput<Output>(contract: ZodType<Output>, input: unknown): Output {
  const parsed = contract.safeParse(input);
  if (!parsed.success) {
    throw new AccountApiError({
      kind: "request-validation",
      message: parsed.error.issues[0]?.message ?? "The form did not match its contract."
    });
  }
  return parsed.data;
}

export const learningApi = {
  dashboard(signal?: AbortSignal): Promise<DashboardResponse> {
    return request("/api/v1/dashboard", dashboardResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  roadmap(signal?: AbortSignal): Promise<RoadmapResponse> {
    return request("/api/v1/roadmap", roadmapResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  catchUp(input: unknown, csrfToken: string): Promise<CatchUpPlanResponse> {
    return request("/api/v1/progress/catch-up-plan", catchUpPlanResponseSchema, {
      method: "POST",
      body: parseInput(catchUpPlanRequestSchema, input),
      csrfToken
    });
  },
  taskPlan(dayNumber: number, signal?: AbortSignal): Promise<DayTaskPlan> {
    return request(`/api/v1/tasks/${dayNumber}`, dayTaskPlanSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  updateTaskPlan(dayNumber: number, input: unknown, csrfToken: string): Promise<DayTaskPlan> {
    return request(`/api/v1/tasks/${dayNumber}`, dayTaskPlanSchema, {
      method: "PUT",
      body: parseInput(updateDayTaskPlanRequestSchema, input),
      csrfToken
    });
  },
  reviews(signal?: AbortSignal): Promise<ReviewsResponse> {
    return request("/api/v1/reviews", reviewsResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  submitReview(reviewId: string, input: unknown, csrfToken: string): Promise<ReviewItem> {
    return request(`/api/v1/reviews/${reviewId}`, reviewItemSchema, {
      method: "PUT",
      body: parseInput(submitReviewRequestSchema, input),
      csrfToken
    });
  },
  periodicReflections(signal?: AbortSignal): Promise<{ reflections: PeriodicReflection[] }> {
    return request("/api/v1/reflections/periodic", periodicReflectionsResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  savePeriodicReflection(
    dayNumber: number,
    input: unknown,
    csrfToken: string
  ): Promise<PeriodicReflection> {
    return request(`/api/v1/reflections/periodic/${dayNumber}`, periodicReflectionSchema, {
      method: "PUT",
      body: parseInput(updatePeriodicReflectionRequestSchema, input),
      csrfToken
    });
  },
  skills(signal?: AbortSignal): Promise<SkillsResponse> {
    return request("/api/v1/skills", skillsResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  achievements(signal?: AbortSignal) {
    const contract = z
      .object({
        achievements: z.array(
          z
            .object({
              key: z.string(),
              title: z.string(),
              description: z.string(),
              earned: z.boolean(),
              awardedAt: z.string().datetime().nullable()
            })
            .strict()
        )
      })
      .strict();
    return request("/api/v1/achievements", contract, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  portfolio(signal?: AbortSignal): Promise<PortfolioResponse> {
    return request("/api/v1/portfolio", portfolioResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  updatePortfolio(
    artifactKey: string,
    input: unknown,
    csrfToken: string
  ): Promise<PortfolioArtifact> {
    return request(`/api/v1/portfolio/${artifactKey}`, portfolioArtifactSchema, {
      method: "PUT",
      body: parseInput(updatePortfolioArtifactRequestSchema, input),
      csrfToken
    });
  },
  jobApplications(signal?: AbortSignal): Promise<{ applications: JobApplication[] }> {
    return request("/api/v1/career/applications", jobApplicationsResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  createJobApplication(input: unknown, csrfToken: string): Promise<JobApplication> {
    return request("/api/v1/career/applications", jobApplicationSchema, {
      method: "POST",
      body: parseInput(createJobApplicationRequestSchema, input),
      csrfToken
    });
  },
  errors(signal?: AbortSignal): Promise<{ entries: ErrorMuseumEntry[] }> {
    return request("/api/v1/errors", errorMuseumResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  saveError(input: unknown, csrfToken: string): Promise<ErrorMuseumEntry> {
    return request("/api/v1/errors", errorMuseumEntrySchema, {
      method: "POST",
      body: parseInput(upsertErrorMuseumRequestSchema, input),
      csrfToken
    });
  },
  notes(signal?: AbortSignal): Promise<{ sources: NoteSource[] }> {
    return request("/api/v1/notes", notesResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  saveNote(input: unknown, csrfToken: string): Promise<{ source: NoteSource }> {
    return request("/api/v1/notes", noteResponseSchema, {
      method: "PUT",
      body: parseInput(upsertNoteRequestSchema, input),
      csrfToken
    });
  },
  async deleteNote(sourceId: string, csrfToken: string): Promise<void> {
    await request(`/api/v1/notes/${sourceId}`, z.null(), {
      method: "DELETE",
      csrfToken
    });
  },
  search(input: unknown, csrfToken: string): Promise<RagSearchResponse> {
    return request("/api/v1/search/notes", ragSearchResponseSchema, {
      method: "POST",
      body: parseInput(ragSearchRequestSchema, input),
      csrfToken
    });
  },
  coach(input: unknown, csrfToken: string): Promise<CoachResponse> {
    const parsed = parseInput(coachRequestSchema, input);
    const path = parsed.action.replaceAll("_", "-");
    return request(`/api/v1/coach/${path}`, coachResponseSchema, {
      method: "POST",
      body: parsed,
      csrfToken
    });
  },
  createPlan(input: unknown, csrfToken: string): Promise<PlannerRun> {
    return request("/api/v1/planner/week", plannerRunSchema, {
      method: "POST",
      body: parseInput(plannerRequestSchema, input),
      csrfToken
    });
  },
  decidePlan(
    runId: string,
    decision: "approve" | "revise",
    input: unknown,
    csrfToken: string
  ): Promise<PlannerRun> {
    return request(`/api/v1/planner/${runId}/${decision}`, plannerRunSchema, {
      method: "POST",
      body: parseInput(plannerDecisionRequestSchema, input),
      csrfToken
    });
  },
  operations(signal?: AbortSignal): Promise<OperationsResponse> {
    return request("/api/v1/ai/operations", operationsResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  runEval(csrfToken: string): Promise<{ run: EvalRun }> {
    return request("/api/v1/evals/local", localEvalResponseSchema, {
      method: "POST",
      csrfToken
    });
  },
  admin(dayNumber = 1, signal?: AbortSignal): Promise<AdminOverviewResponse> {
    return request(`/api/v1/admin/overview?dayNumber=${dayNumber}`, adminOverviewResponseSchema, {
      ...(signal === undefined ? {} : { signal })
    });
  },
  updateAdminFeatureFlag(
    key: string,
    input: unknown,
    csrfToken: string
  ): Promise<AdminFeatureFlag> {
    return request(`/api/v1/admin/feature-flags/${key}`, adminFeatureFlagSchema, {
      method: "PUT",
      body: parseInput(adminFeatureFlagUpdateRequestSchema, input),
      csrfToken
    });
  },
  runAdminMockScenario(input: unknown, csrfToken: string): Promise<AdminMockScenarioResponse> {
    return request("/api/v1/admin/mock-scenarios", adminMockScenarioResponseSchema, {
      method: "POST",
      body: parseInput(adminMockScenarioRequestSchema, input),
      csrfToken
    });
  },
  resetAdminDemoData(input: unknown, csrfToken: string): Promise<AdminResetDemoDataResponse> {
    return request("/api/v1/admin/reset-demo-data", adminResetDemoDataResponseSchema, {
      method: "POST",
      body: parseInput(adminResetDemoDataRequestSchema, input),
      csrfToken
    });
  }
};
