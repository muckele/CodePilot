import { z } from "zod";

import { curriculumDayResponseSchema, httpsUrlSchema, nonEmptyStringSchema } from "./curriculum.js";

export const mongoIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const isoLocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must use YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Must be a real calendar date.");
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must use 24-hour HH:mm time.");

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Must be a supported IANA timezone.");

export const emailAddressSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use no more than 128 characters.");

export const accountAccessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const registrationModeSchema = z.enum(["closed", "invite_only", "open"]);

export const targetRoleSchema = z.enum([
  "Full-Stack AI Application Engineer",
  "Applied AI Engineer",
  "AI Solutions Engineer"
]);

export const aiPrivacyModeSchema = z.enum(["local_only", "ask_before_external"]);
export const themePreferenceSchema = z.enum(["system", "light", "dark"]);
export const motionPreferenceSchema = z.enum(["system", "reduced", "gentle"]);
export const reviewPreferenceSchema = z.enum(["before_mission", "after_mission"]);

export const onboardingProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    timezone: ianaTimezoneSchema,
    startDate: isoLocalDateSchema,
    commitmentMinutes: z.literal(30),
    preferredCodingTime: localTimeSchema,
    routineCue: z.string().trim().min(1).max(120),
    codingPlace: z.string().trim().min(1).max(120),
    implementationIntention: z.string().trim().min(1).max(300),
    whyItMatters: z.string().trim().min(1).max(500),
    githubUsername: z
      .string()
      .trim()
      .max(39)
      .regex(
        /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)?$/,
        "Use a valid GitHub username."
      ),
    targetRoles: z.array(targetRoleSchema).min(1).max(3),
    aiPrivacyMode: aiPrivacyModeSchema,
    themePreference: themePreferenceSchema,
    motionPreference: motionPreferenceSchema,
    // Optional for profiles persisted before editable V2 settings shipped. New
    // onboarding and settings writes always include an explicit preference.
    reviewPreference: reviewPreferenceSchema.optional()
  })
  .strict();

export const accountUserSchema = z
  .object({
    id: mongoIdSchema,
    email: emailAddressSchema,
    onboardingComplete: z.boolean(),
    profile: onboardingProfileSchema.nullable(),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const registerRequestSchema = z
  .object({
    email: emailAddressSchema,
    password: passwordSchema,
    invitationToken: accountAccessTokenSchema.optional()
  })
  .strict();

export const loginRequestSchema = registerRequestSchema.omit({ invitationToken: true }).strict();

export const passwordResetRequestSchema = z
  .object({
    token: accountAccessTokenSchema,
    password: passwordSchema
  })
  .strict();

export const mvpConfigurationResponseSchema = z
  .object({
    registrationMode: registrationModeSchema,
    aiProvider: z.enum(["mock", "python_mock", "openai", "local"]),
    externalAiEnabled: z.boolean(),
    agentEnabled: z.boolean()
  })
  .strict();

export const csrfResponseSchema = z
  .object({
    csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43,64}$/),
    expiresAt: isoDateTimeSchema
  })
  .strict();

export const authSessionResponseSchema = z
  .object({
    authenticated: z.literal(true),
    user: accountUserSchema,
    csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43,64}$/)
  })
  .strict();

export const meResponseSchema = z.discriminatedUnion("authenticated", [
  z
    .object({
      authenticated: z.literal(false)
    })
    .strict(),
  z
    .object({
      authenticated: z.literal(true),
      user: accountUserSchema
    })
    .strict()
]);

export const onboardingRequestSchema = onboardingProfileSchema;
export const onboardingResponseSchema = z
  .object({
    user: accountUserSchema
  })
  .strict();

export const progressModeSchema = z.enum(["core", "recovery"]);
export const progressStatusSchema = z.enum([
  "not_started",
  "opened",
  "in_progress",
  "core_completed",
  "recovery_completed",
  "intentionally_skipped",
  "rescheduled"
]);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const evidenceKindSchema = z.enum([
  "commit_url",
  "test_name",
  "screenshot_url",
  "demo_url",
  "text_explanation",
  "local_artifact_path"
]);

const progressEvidenceFieldsSchema = z
  .object({
    kind: evidenceKindSchema,
    label: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(2_000)
  })
  .strict();

export const progressEvidenceRequestSchema = progressEvidenceFieldsSchema
  .extend({
    idempotencyKey: idempotencyKeySchema
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.kind === "commit_url" ||
      value.kind === "screenshot_url" ||
      value.kind === "demo_url"
    ) {
      try {
        httpsUrlSchema.parse(value.value);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "URL evidence must be a valid HTTPS URL without embedded credentials."
        });
      }
    }
  });

export const progressEvidenceSchema = progressEvidenceFieldsSchema
  .extend({
    id: mongoIdSchema,
    idempotencyKey: idempotencyKeySchema,
    createdAt: isoDateTimeSchema
  })
  .strict();

export const progressReflectionRequestSchema = z
  .object({
    confused: z.string().trim().max(1_000),
    mentalModelChanged: z.string().trim().max(1_000),
    retrieveLater: z.string().trim().max(1_000),
    idempotencyKey: idempotencyKeySchema
  })
  .strict();

export const progressReflectionSchema = progressReflectionRequestSchema
  .omit({ idempotencyKey: true })
  .extend({
    updatedAt: isoDateTimeSchema.nullable()
  })
  .strict();

export const progressStatusRequestSchema = z
  .object({
    intent: z.enum(["start", "complete"]),
    mode: progressModeSchema,
    idempotencyKey: idempotencyKeySchema,
    expectedVersion: z.number().int().min(0).optional()
  })
  .strict();

export const progressDayResponseSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(365),
    status: progressStatusSchema,
    selectedMode: progressModeSchema.nullable(),
    evidence: z.array(progressEvidenceSchema).max(25),
    reflection: progressReflectionSchema,
    version: z.number().int().min(0),
    startedAt: isoDateTimeSchema.nullable(),
    completedAt: isoDateTimeSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable(),
    statusReason: z.string().max(500).nullable().optional(),
    rescheduledFor: isoLocalDateSchema.nullable().optional()
  })
  .strict();

export const authenticatedTodayResponseSchema = z
  .object({
    selection: z.enum(["next_incomplete", "future_start", "curriculum_complete"]),
    user: accountUserSchema,
    day: curriculumDayResponseSchema.nullable(),
    progress: progressDayResponseSchema.nullable(),
    futureStartDate: isoLocalDateSchema.nullable()
  })
  .strict();

export const deleteAccountRequestSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.literal("DELETE")
  })
  .strict();

const exportJsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(exportJsonValueSchema),
    z.record(z.string(), exportJsonValueSchema)
  ])
);

const forbiddenExportKeys = new Set([
  "_id",
  "__v",
  "userId",
  "consumedByUserId",
  "reviewItemId",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "csrfHash",
  "sessionSecret",
  "credential"
]);

function containsForbiddenExportKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenExportKey);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenExportKeys.has(key) ||
      key.toLowerCase().endsWith("hash") ||
      containsForbiddenExportKey(child)
  );
}

const exportRecordsSchema = z.array(z.record(z.string(), exportJsonValueSchema));

export const accountExportSchema = z
  .object({
    schemaVersion: z.literal("codelift.account-export.v1"),
    exportedAt: isoDateTimeSchema,
    account: accountUserSchema,
    sourceRecords: z
      .object({
        progress: exportRecordsSchema,
        reflections: exportRecordsSchema,
        authenticatedActivity: exportRecordsSchema,
        reviewItems: exportRecordsSchema,
        misconceptions: exportRecordsSchema,
        errorMuseumEntries: exportRecordsSchema,
        portfolioArtifacts: exportRecordsSchema,
        jobApplications: exportRecordsSchema
      })
      .strict(),
    derivedRecords: z
      .object({
        xpEvents: exportRecordsSchema,
        achievements: exportRecordsSchema,
        skillEvidence: exportRecordsSchema,
        aiTraces: exportRecordsSchema,
        evalRuns: exportRecordsSchema,
        indexedSources: exportRecordsSchema,
        agentRuns: exportRecordsSchema,
        invitationMetadata: exportRecordsSchema,
        passwordResetMetadata: exportRecordsSchema
      })
      .strict()
  })
  .strict()
  .superRefine((value, context) => {
    if (containsForbiddenExportKey(value)) {
      context.addIssue({
        code: "custom",
        message: "Account exports cannot contain secret or internal fields."
      });
    }
  });

export const validationFieldErrorSchema = z
  .object({
    field: nonEmptyStringSchema,
    message: nonEmptyStringSchema
  })
  .strict();

export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export type ReviewPreference = z.infer<typeof reviewPreferenceSchema>;
export type AccountUser = z.infer<typeof accountUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type MvpConfigurationResponse = z.infer<typeof mvpConfigurationResponseSchema>;
export type CsrfResponse = z.infer<typeof csrfResponseSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProgressMode = z.infer<typeof progressModeSchema>;
export type ProgressStatus = z.infer<typeof progressStatusSchema>;
export type ProgressEvidenceRequest = z.infer<typeof progressEvidenceRequestSchema>;
export type ProgressEvidence = z.infer<typeof progressEvidenceSchema>;
export type ProgressReflectionRequest = z.infer<typeof progressReflectionRequestSchema>;
export type ProgressReflection = z.infer<typeof progressReflectionSchema>;
export type ProgressStatusRequest = z.infer<typeof progressStatusRequestSchema>;
export type ProgressDayResponse = z.infer<typeof progressDayResponseSchema>;
export type AuthenticatedTodayResponse = z.infer<typeof authenticatedTodayResponseSchema>;
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export type AccountExport = z.infer<typeof accountExportSchema>;
