import { z } from "zod";

import { nonEmptyStringSchema } from "./curriculum.js";
import { validationFieldErrorSchema } from "./account.js";

/**
 * RFC 9457-style problem details plus an optional request correlation ID.
 * `type` and `instance` are URI references, so relative values and
 * `about:blank` remain valid.
 */
export const problemDetailsSchema = z
  .object({
    type: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    status: z.number().int().min(400).max(599),
    detail: nonEmptyStringSchema.optional(),
    instance: nonEmptyStringSchema.optional(),
    requestId: nonEmptyStringSchema.optional(),
    errors: z.array(validationFieldErrorSchema).max(50).optional()
  })
  .strict();

export const apiProblemSchema = problemDetailsSchema;

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type ApiProblem = ProblemDetails;
