import { z } from "zod";

export const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Must contain non-whitespace characters.");

export const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "Must use HTTPS.");

export const curriculumResourceTypeSchema = z.enum([
  "course",
  "docs",
  "guide",
  "lesson",
  "reference"
]);

export const curriculumResourceSchema = z
  .object({
    provider: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    url: httpsUrlSchema,
    type: curriculumResourceTypeSchema
  })
  .strict();

export const curriculumResourceLinkSchema = curriculumResourceSchema
  .extend({
    id: nonEmptyStringSchema
  })
  .strict();

export const curriculumTimeBlockSchema = z
  .object({
    label: nonEmptyStringSchema,
    minutes: z.number().int().positive()
  })
  .strict();

export const curriculumWeekSchema = z
  .object({
    weekNumber: z.number().int().min(1).max(52),
    monthNumber: z.number().int().min(1).max(12),
    phaseTitle: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    milestone: nonEmptyStringSchema,
    skillTags: z.array(nonEmptyStringSchema).min(1)
  })
  .strict();

export const curriculumSeedDaySchema = z
  .object({
    dayNumber: z.number().int().min(1).max(365),
    weekNumber: z.number().int().min(1).max(53),
    monthNumber: z.number().int().min(1).max(12),
    phaseTitle: nonEmptyStringSchema,
    weekTitle: nonEmptyStringSchema,
    modeLabel: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    learningSeed: nonEmptyStringSchema,
    buildTask: nonEmptyStringSchema,
    corePrinciple: nonEmptyStringSchema,
    retrievalQuestion: nonEmptyStringSchema,
    tinyArtifact: nonEmptyStringSchema,
    recoveryTask: nonEmptyStringSchema,
    optionalStretchSeed: nonEmptyStringSchema,
    coreSchedule: z.array(curriculumTimeBlockSchema).min(1),
    skillTags: z.array(nonEmptyStringSchema).min(1),
    resourceIds: z.array(nonEmptyStringSchema).min(1),
    resourceLinks: z.array(curriculumResourceLinkSchema).min(1),
    prerequisiteDayNumbers: z.array(z.number().int().min(1).max(365))
  })
  .strict();

export const knowledgeCheckKindSchema = z.enum(["recall", "application", "explanation"]);

export const knowledgeCheckSchema = z
  .object({
    id: nonEmptyStringSchema,
    kind: knowledgeCheckKindSchema,
    prompt: nonEmptyStringSchema,
    hint: nonEmptyStringSchema,
    explanation: nonEmptyStringSchema
  })
  .strict();

export const resourceCheckStatusSchema = z.enum([
  "source_verified",
  "reachable",
  "unknown",
  "unreachable"
]);

export const curriculumRuntimeResourceLinkSchema = curriculumResourceLinkSchema
  .extend({
    topicHint: nonEmptyStringSchema,
    lastCheckedStatus: resourceCheckStatusSchema
  })
  .strict();

export const curriculumDayResponseSchema = curriculumSeedDaySchema
  .omit({ resourceLinks: true })
  .extend({
    learningObjective: nonEmptyStringSchema,
    whyItMattersForAIEngineering: nonEmptyStringSchema,
    mentalModel: nonEmptyStringSchema,
    commonMistake: nonEmptyStringSchema,
    recoveryMinutes: z.number().int().min(1).max(5),
    optionalStretchMinutes: z.number().int().min(1).max(10),
    resourceLinks: z.array(curriculumRuntimeResourceLinkSchema).min(1),
    knowledgeChecks: z
      .array(knowledgeCheckSchema)
      .length(3)
      .superRefine((checks, context) => {
        const kinds = new Set(checks.map((check) => check.kind));
        for (const kind of knowledgeCheckKindSchema.options) {
          if (!kinds.has(kind)) {
            context.addIssue({
              code: "custom",
              message: `Knowledge checks must include ${kind}.`
            });
          }
        }
      }),
    teachBackPrompt: nonEmptyStringSchema,
    retrievalPrompts: z.array(nonEmptyStringSchema).min(3),
    acceptableEvidenceTypes: z.array(
      z.enum([
        "commit_url",
        "test_name",
        "screenshot_url",
        "demo_url",
        "text_explanation",
        "local_artifact_path"
      ])
    ),
    portfolioMilestone: nonEmptyStringSchema.optional()
  })
  .strict();

export const curriculumBlueprintSchema = z
  .object({
    schemaVersion: z.literal("2.0.0"),
    title: nonEmptyStringSchema,
    targetRoles: z.array(nonEmptyStringSchema).min(1),
    dailyCoreMinutes: z.literal(30),
    recoveryMinutesMax: z.literal(5),
    optionalStretchMinutesMax: z.literal(10),
    resourceCatalog: z.record(nonEmptyStringSchema, curriculumResourceSchema),
    weeks: z.array(curriculumWeekSchema),
    days: z.array(curriculumSeedDaySchema)
  })
  .strict();

export const apiCurriculumDayResponseSchema = curriculumDayResponseSchema;

export type CurriculumResourceType = z.infer<typeof curriculumResourceTypeSchema>;
export type CurriculumResource = z.infer<typeof curriculumResourceSchema>;
export type CurriculumResourceLink = z.infer<typeof curriculumResourceLinkSchema>;
export type CurriculumTimeBlock = z.infer<typeof curriculumTimeBlockSchema>;
export type CurriculumWeek = z.infer<typeof curriculumWeekSchema>;
export type CurriculumSeedDay = z.infer<typeof curriculumSeedDaySchema>;
export type CurriculumBlueprint = z.infer<typeof curriculumBlueprintSchema>;
export type KnowledgeCheck = z.infer<typeof knowledgeCheckSchema>;
export type CurriculumRuntimeResourceLink = z.infer<typeof curriculumRuntimeResourceLinkSchema>;
export type CurriculumDayResponse = z.infer<typeof curriculumDayResponseSchema>;
